## Why

Sales Management (`/appointments`) đã khoá sửa trên bảng ở cột Dịch vụ chi tiết + Tài chính → cần chỗ sửa. Sếp gửi mẫu drawer sửa 1 lịch hẹn: đầu drawer = Tên, SĐT, dịch vụ (nhóm DV – DV chi tiết); 4 khối: Khách hàng & Booking, Dịch vụ & Tài chính, Nhân sự, Ghi chú Sales. Ghi chú trong mẫu là **ghi chú của Sales**, khác cột `note` hiện tại (Telesales ghi ở Booking Management / Form SMAX).

## What Changes

- DB `clinic_appointments`: thêm `paid_amount bigint` (Thu thêm sau Deposit, IDR ≥ 0, null = chưa thu) + `sales_note text not null default ''`. Trigger log theo dõi thêm 2 cột.
- Drawer **Sửa lịch hẹn** (bấm tên khách ở bảng):
  - Đầu: Tên (+ icon mở drawer Thông tin khách hàng), dòng phụ `SĐT · Nhóm DV – DV chi tiết · Xác nhận lịch`.
  - 1. Khách hàng & Booking: Ngày giờ hẹn, Trạng thái (chỉ Sales/admin đổi).
  - 2. Dịch vụ & Tài chính: Nhóm DV, DV chi tiết (lọc theo nhóm); thẻ Tài chính: Deposit (của khách, chỉ xem), Giá trị DV, Thực thu = Deposit + Thu thêm (xanh), Phải thu = Giá trị DV − Thực thu, tối thiểu 0 (cam); 2 ô nhập Thu thêm sau Deposit + Giá trị DV.
  - 3. Nhân sự: Tele (chỉ xem), Sales, Master.
  - 4. Ghi chú Sales (`sales_note`).
  - Nút Lưu cập nhật: chỉ gửi trường đã đổi.
- Không có quyền sửa → drawer chỉ xem (form disabled).

## Impact

- Migration `supabase/migrations/20261119130000_appointment_paid_sales_note.sql` — **chạy TRƯỚC khi deploy** (trang select 2 cột mới).
- Sửa: `types/appointment.ts`, `lib/appointments.ts`, `app/(app)/appointments/page.tsx`, `components/appointments/appointments-manager.tsx`, `components/customers/appointment-history-drawer.tsx`, `messages/{vi,en}.json`. Mới: `components/appointments/appointment-drawer.tsx`.
- Deposit là của khách (không theo lịch) → khách có nhiều lịch thì mỗi lịch đều tính cùng Deposit (giống cột Tài chính trên bảng).
