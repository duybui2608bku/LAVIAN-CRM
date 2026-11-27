## Why

Phân tích đa vai trò ngày 27/11/2026 (`docs/analysis/2026-11-27-phan-tich-da-vai-tro.md`) tìm ra các lỗi ở thẻ và tour, cùng nhiều chỗ một dữ liệu đang lưu ở nhiều nơi khiến các màn hình ra số khác nhau. Người dùng đã chốt hướng sửa như sau:

1. **Huỷ thẻ**: hiện không huỷ được thẻ có tour dự kiến. Sửa thành huỷ thẻ thì xoá luôn các tour **chưa ai nhận** (gồm tour dự kiến và tour Chờ nhận).
2. **Mỗi thẻ chỉ có 1 dịch vụ chính, là Mày hoặc Môi.** Chặn ngay khi tạo thẻ và khi thêm dịch vụ.
3. **Hoá đơn ở trang Tour**: giá dòng thẻ là giá **trọn gói** (mày 500 thì làm mấy buổi vẫn là 500), nên tiền này chỉ được tính 1 lần.
4. **Gom dữ liệu trùng về một nguồn**: Master, Huỷ / Đổi lịch, KPI Đặt lịch / Đến cơ sở, Tiền cọc.

## What Changes

- `cancelCard`:
  - Chặn huỷ khi thẻ có tour đã có Master nhận, hoặc đã có tiền thu (giữ như cũ).
  - Còn lại thì xoá mềm mọi tour của thẻ (tour dự kiến + tour Chờ nhận), rồi huỷ thẻ.
- **Vùng chính của thẻ**: vùng Mày (nhóm `alis` + `laser`) và vùng Môi (nhóm `bibir` + `lips_treatment`) loại trừ nhau trong cùng một thẻ. Chặn ở 2 lớp:
  - Client: drawer bán thẻ / thêm DV khoá DV khác vùng.
  - DB: trigger `treatment_card_items_group_guard` raise `card_area_taken`.
  - Thẻ cũ đã lẫn cả hai vùng vẫn giữ nguyên.
- **Hoá đơn trang Tour**:
  - Giá dòng thẻ chỉ ghi ở **tour thật đầu tiên** của dòng (sớm nhất theo ngày). Các buổi sau hiện "—".
  - Tổng trên trang, tổng theo Master, Excel và phiếu in đều cộng theo quy tắc này.
  - Công Master giữ nguyên: 7% Làm mới / 3% Dặm, tính trên giá cả dòng.
- **Master**:
  - Nguồn chuẩn là `tours.technician_id`; người phụ ghi ở `appointment_performers`.
  - **Bỏ cột `customers.technician_id`** cùng trigger `tours_fill_customer_technician`. Khách hàng / 360° hiện Master của tour thật gần nhất.
  - Viết lại trigger tự điền Master vào lịch hẹn:
    - Chỉ điền lịch cùng khách, cùng ngày tour; bỏ nhánh "lịch bán thẻ".
    - Chạy cả khi đổi ngày tour, chốt tour dự kiến hoặc xoá tour.
    - Trả tour / dời / xoá thì gỡ Master cũ khỏi lịch, nếu lịch chưa ở trạng thái Đang làm / Đã làm.
- **Huỷ / Đổi lịch**:
  - Nguồn chuẩn là `visit_status`. Cột `booking_confirm` chỉ còn `pending` / `confirmed` (đổi check DB).
  - Cột "Xác nhận lịch" vẫn hiện đủ 4 trạng thái, tính bằng `confirmStatus()`.
  - Khi chọn Huỷ / Đổi lịch, server ghi vào `visit_status`. Telesales được làm việc này khi khách chưa đến.
- **KPI chung `lib/kpi.ts`**, dùng cho `/reports`, Báo cáo Telesales và pipeline `/customers`:
  - Đặt lịch = số lịch hẹn **tạo** trong kỳ.
  - Đến cơ sở = lịch có ngày hẹn trong kỳ và `visit_status` là đã đến.
  - Huỷ / Đổi lịch = lấy theo `visit_status`.
  - Đặt cọc = khách có `deposit_amount > 0`.
- **Tiền cọc**:
  - Nguồn chuẩn là `customers.deposit_amount`. Thẻ chỉ ghi phần đã trừ (`deposit_used`).
  - Trigger DB chặn sửa cọc xuống dưới tổng phần đã trừ vào các thẻ chưa huỷ (`deposit_below_used`).
  - Hồ sơ 360° hiện cọc đã trừ vào thẻ và cọc còn lại.

## Capabilities

### Modified Capabilities
- `treatment-cards`: huỷ thẻ, vùng chính của thẻ.
- `tour`: Hoá đơn tính theo buổi đầu.
- `appointments`: Master lịch hẹn, Huỷ / Đổi lịch.
- `reports`: định nghĩa KPI chung.
- `customers`: Master suy ra từ tour, chặn sửa cọc.

## Impact

- **DB:** migration `20261127120000_card_tour_single_source.sql`.
  - **Phải deploy code trước**, vì migration xoá cột `customers.technician_id` mà code cũ còn đang đọc.
  - Dữ liệu hiện tại: 5 khách có Master gán tay nhưng không có tour khớp, sẽ mất giá trị này. Chưa lịch hẹn nào dùng `booking_confirm` = cancelled / rescheduled. Có 2 thẻ đang lẫn cả Mày lẫn Môi, giữ nguyên.
- **Code:**
  - `lib/{kpi,cards,appointments,reports,telesales-report,customers}.ts` (+ test).
  - `app/(app)/{cards,customers,appointments,reports,tour}/…`.
  - `components/{cards,tour,appointments,customers}/…`.
  - `tsconfig.json` thêm `allowImportingTsExtensions`, để các file trong `lib` import lẫn nhau bằng đuôi `.ts` (cách này chạy được cả với `node --test`).
