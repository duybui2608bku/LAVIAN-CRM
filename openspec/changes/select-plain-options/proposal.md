## Why

Sếp gửi ảnh ô lọc "All statuses" ở trang Khách tiềm năng: mỗi lựa chọn trong dropdown là một tag màu (Interested xanh, No response xám, Converted xanh lá) — rối mắt, không giống CRM chuẩn (Salesforce/HubSpot: danh sách chọn là chữ trần, màu chỉ ở ô hiển thị trên bảng). Yêu cầu thêm: rà lại phân cấp chữ đậm/nhạt và thứ tự phần tử cho thuận tay, đồng nhất giữa các trang.

Phân tích (UX/BA):
1. **Tag màu trong danh sách option** — lặp ở 4 trang: Khách tiềm năng (lọc + sửa Status), Khách hàng (lọc Stage, sửa Stage/Source/Đánh giá, form), Booking Management (sửa Status), Sales Management (sửa Status). Mỗi option là một "nút" màu → mắt phải đọc màu thay vì chữ, các option nhìn như đã được chọn.
2. **Thứ tự khối không đồng nhất** — Booking: Thẻ số liệu → Tab → Thanh lọc. Khách tiềm năng: Thẻ số liệu → Thanh lọc → Tab. Thứ tự ô lọc cũng ngược nhau (Booking: Tìm → Trạng thái → Tele; Tiềm năng: Tìm → Tele → Trạng thái).
3. **Thứ tự cột Khách tiềm năng chưa theo luồng công việc** — đây là danh sách việc follow-up (đã sắp theo giờ liên hệ lại), nhưng cột "Liên hệ lại" nằm cuối, "Ngày tạo"/"Nguồn" (thông tin tra cứu) lại nằm ngay sau tên.
4. **Quá nhiều tag trong một ô** — ô Status có tag trạng thái + tag "Cân nhắc" xếp chồng; ô Liên hệ lại có thêm tag Quá hạn/Hôm nay/Sắp tới. 3 tag màu/1 dòng làm mất điểm nhấn.

## What Changes

- **Quy tắc chung:** danh sách option của mọi Select (lọc toolbar, sửa inline, form) = **chữ trần**. Màu/tag chỉ dùng ở phần hiển thị giá trị trong ô bảng (trạng thái đóng của InlineSelect).
- Khách tiềm năng:
  - Thứ tự khối: Thẻ số liệu → Tab → Thanh lọc (như Booking). Ô lọc: Tìm → Trạng thái → Tele.
  - Thứ tự cột: Khách hàng → Liên hệ lại → Status → Sales Status → Tele → Nguồn → Ngày tạo.
  - Ô Status: tag "Cân nhắc" → chữ nhạt cùng dòng số lần follow-up (`Cân nhắc · 3 follow-up`).
  - Ô Liên hệ lại: tag Quá hạn/Hôm nay/Sắp tới → chữ nhỏ có màu ngữ nghĩa (đỏ / cam / nhạt), không viền nền.
- Khách hàng, Booking Management, Sales Management: option select bỏ tag (ô hiển thị giữ tag).

## Capabilities

### Modified Capabilities
- `ui-design-system`: thêm quy tắc option select là chữ trần.

## Impact

- Sửa: `components/customers/potential-manager.tsx`, `components/customers/customers-manager.tsx`, `components/appointments/bookings-manager.tsx`, `components/appointments/appointments-manager.tsx`.
- **Không** migration DB, **không** đổi i18n key, **không** đổi API/dữ liệu.
