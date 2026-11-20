# Proposal: customer-360-phase1

## Why

Sếp chốt tài liệu "Chốt phạm vi Customer Profile CRM" v1.1 (20/11/2026): cần một **hồ sơ khách 360°** (popup Customer Brief) dùng chung toàn CRM, quản lý theo **khách hàng** (không theo lịch hẹn). Hồ sơ phải gom mọi nguồn (Telesales, Sales, Master, hội thoại SMAX), có chân dung khách gắn nguồn xác minh và lưu lịch sử sửa, nhu cầu Upsell thành pipeline, tài chính tách 3 vùng, cùng các quy tắc chặn ở Drawer Sales.

Hiện tại thông tin khách rải ở nhiều drawer (Thông tin khách, Ghi chú, Lịch sử lịch hẹn, modal Tin nhắn). Chưa có chân dung, nhu cầu, ảnh B/A, người thực hiện thứ hai, cũng chưa có quy tắc chặn khi đổi trạng thái.

Giai đoạn 1 làm các câu đã chốt mà không cần AI. Quyết định bổ sung của người dùng cùng ngày:
- Lưu 30 tin SMAX gần nhất lúc tạo lead.
- Gắn popup vào các trang đang có.
- Tab CSKH để "Coming soon".
- Nhiều người thực hiện, mỗi người một vai trò: Mapping / Phun-xăm / Hỗ trợ / Sales.
- Master và Sales đều được chuyển lịch sang "Đã thực hiện".
- Master và Telesales không xem tài chính.
- Ảnh B/A làm luôn: không bắt buộc, gom theo lịch hẹn.

## What Changes

- **Popup Customer Detail 360°** (mới, dùng chung), mở theo `customer_id`:
  - Đầu popup có 3 ô tóm tắt: Mong muốn / Nỗi lo / Nhu cầu tiếp theo.
  - Nút Trước/Tiếp đi theo danh sách đang lọc/sắp xếp của bảng gọi popup. Ở khách cuối thì nút bị khoá.
  - Đóng popup thì bảng giữ nguyên bộ lọc, trang và vị trí cuộn.
  - 7 tab: Tổng quan · Chân dung · Dịch vụ & Upsell · Ảnh B/A · Hội thoại · Lịch sử & Ghi chú · CSKH (Coming soon).
  - Footer có nút "Ghi chú nhanh" và "Chuyển sang nhập liệu" (mở Drawer Sales). Popup và Drawer không bao giờ mở chồng nhau.
- **Phân quyền theo vai trò tài khoản (D1):** gợi ý đầu tab theo bộ phận đăng nhập. Ẩn **Tài chính** với Telesales và Master, ẩn **Ảnh B/A** với Telesales. Server không trả dữ liệu bị ẩn.
- **Chân dung khách (B1–B5):** 6 mục (Mong muốn, Nỗi lo, Sở thích, Hành vi quyết định, Giao tiếp phù hợp, Tính cách). Mọi bộ phận nhập được, nhập ngay trong popup. Mỗi lần nhập gắn nhãn nguồn **Khách nói** / **NV nhận định**, có thể gắn kèm tin nhắn gốc. Lưu dạng **chỉ thêm, không sửa, không xoá**: màn hình hiện bản mới nhất, xem được lịch sử ai sửa, lúc nào.
- **Nhu cầu / Upsell pipeline (C1, C2):** một nguồn dữ liệu duy nhất, hiển thị ở ô đầu popup và ở tab Upsell. Nguồn: [Khách đã hỏi] / [Sales khai thác]. Trạng thái: Nhu cầu → Tư vấn → Upsell → Thành công / Thất bại, lưu lịch sử đổi trạng thái.
- **Tài chính 3 vùng (E1, E2):** Tổng tích luỹ (Giá trị DV, Thực thu, Phải thu), Đơn hiện tại (lịch gần nhất), Lịch sử mua. "Phải thu: Chưa xác định" khi đã có cọc mà Giá trị DV = 0.
- **Quy tắc Drawer (E3):**
  - Giá trị DV (> 0) không được nhỏ hơn số đã thu.
  - "Đang thực hiện" bắt buộc có Master hoặc Sales.
  - "Đã thực hiện" bắt buộc có Master. Master (bộ phận technician) được chọn "Đã thực hiện".
  - **Người thực hiện thêm** có vai trò (Mapping / Phun-xăm / Hỗ trợ / Sales).
- **Ảnh B/A (F1):** Upload ở Drawer (ảnh Trước/Sau, không bắt buộc), lưu bucket **riêng tư** và xem bằng signed URL. Popup chỉ xem, gom theo từng lịch hẹn.
- **Hội thoại (B5):** dùng lại cách lấy tin SMAX trực tiếp (tăng lên 30 tin), có ô tìm trong hội thoại. Lead-form lưu thêm **bản chụp 30 tin** vào `customers.smax_messages` (dữ liệu cho AI ở Giai đoạn 2, và dự phòng khi SMAX lỗi).
- **Lịch sử & Ghi chú:** gộp vào 1 dòng thời gian, lọc được theo loại. Gồm log lịch hẹn, ghi chú Telesales của khách, ghi chú lịch hẹn, ghi chú Sales. Ghi chú nhanh lưu vào `customers.notes`, có 4 tiêu đề gợi ý Tư vấn / Kỹ thuật / CSKH / Phản hồi.
- **Lịch nhắc (C3):** chỉ hiển thị các lịch nhắc đang mở của khách (`customer_reminders`), không có luồng tạo mới.
- **Gắn vào trang:** ở Quản lý bán hàng, bấm tên khách mở popup (icon ✎ vẫn mở Drawer). Quản lý khách hàng, Khách tiềm năng và Quản lý đặt lịch thêm nút mở popup.

## Non-goals (Giai đoạn 2)

AI bóc tách và gắn tag theo danh mục (B3), AI tạo nhu cầu tự động, đồng bộ hội thoại liên tục, ma trận quyền chi tiết (F4, mục 3) ngoài 2 quy tắc ẩn ở trên, ghi chú chuyên môn Master (H2), nội dung tab CSKH (I1, I2), các phân hệ Customer Data HUB / Master Management / CSKH Management.

## Impact

- **DB:** migration `supabase/migrations/20261120120000_customer_360.sql`. **Phải chạy trước khi deploy code.**
- **Server:** `app/(app)/customers/customer-360-actions.ts` (mới), `app/(app)/appointments/actions.ts`, `app/lead-form/actions.ts`, `lib/appointments.ts`, `lib/smax-messages.ts`, `lib/customer-360.ts` (mới, có test).
- **UI:** `components/customers/customer-360/*` (mới), `components/appointments/{appointments-manager,appointment-drawer}.tsx`, `components/customers/{customers-manager,potential-manager}.tsx`, `components/appointments/bookings-manager.tsx`.
- **Types / i18n:** `types/customer-360.ts` (mới), `types/appointment.ts`, `messages/{vi,en,id}.json`.
- Báo cáo, Tour và phiếu tour không đổi. `technician_id` vẫn là "Master" của lịch.
