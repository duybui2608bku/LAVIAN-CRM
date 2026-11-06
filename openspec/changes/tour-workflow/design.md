## Context

`clinic_appointments` đang chứa technician_id, service_detail, service_session, bill_amount, payment_method (thêm hôm nay, mới 2 dòng dữ liệu). `/tour` đọc tour từ lịch hẹn. Ảnh upload qua `/api/upload` (CDN ngoài) trả URL.

## Goals / Non-Goals

**Goals:** tách tour khỏi lịch hẹn; KTV thao tác bằng điện thoại thật nhanh (nhận tour, chụp ảnh 1 chạm); admin chốt cuối.
**Non-Goals:** nối tour với lịch hẹn; snapshot tỷ lệ % (đổi tỷ lệ áp ngược như trước); thông báo realtime.

## Decisions

- **Bảng `tours`** (soft-delete, RLS nhân viên active giống `clinic_appointments`, chỉ grant select/insert/update). Ảnh = 3 cột `text[]` (`before_images`, `after_images`, `extra_images`) — không cần bảng ảnh riêng.
- **Trạng thái suy ra, không cột status:** `technician_id is null` → Chờ nhận; có KTV, `confirmed_at is null` → Chưa xác nhận; `confirmed_at` → Đã xác nhận.
- **Nhận tour nguyên tử:** `update … set technician_id = me where id = ? and technician_id is null` — 0 dòng → "Tour đã có người nhận". KTV có thể "Trả tour" khi chưa xác nhận.
- **Quyền sửa** (server action): admin sửa mọi thứ; người khác chỉ sửa tour chưa xác nhận; KTV chỉ sửa tour của mình; chỉ admin gán KTV/xác nhận. Trigger `tours_protect_confirmation` chặn ở DB: non-admin không được đổi `confirmed_*` hay sửa tour đã xác nhận.
- **Xác nhận** đòi có KTV + dịch vụ chi tiết + bill.
- **Thực thu** = `tourAmount(detail, session, bill)` trong `lib/tours.ts` (chuyển từ `lib/appointments.ts`). Lần: 1–20, bắt buộc với laser/plasma/retouch, null với new/debt (check constraint).
- **Ngày** là cột `date` → lọc tháng chính xác ở server, không lệch múi giờ.
- **Ảnh:** `<input type=file accept=image/* capture=environment>` mở camera sau; ảnh nén ở client (canvas, cạnh dài ≤1600px, JPEG) rồi upload `/api/upload` và lưu ngay vào tour (không chờ nút Lưu). Ảnh thêm không ép camera (chọn được thư viện cho ảnh bill).
- **Hai migration:** tạo bảng trước (code cũ vẫn chạy), xoá cột cũ sau khi deploy.

## Risks / Trade-offs

- Thêm ảnh đồng thời từ 2 máy có thể ghi đè mảng → chấp nhận (1 KTV/tour).
- Danh sách khách tải toàn bộ cho select (giới hạn 1000 dòng Supabase) — giống trang Lịch hẹn hiện tại.
