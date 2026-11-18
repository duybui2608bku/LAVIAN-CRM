-- Mục đích: thu hẹp quyền theo bộ phận.
--   1. Telesales: bỏ `appointments.view` (không vào menu /appointments) nhưng GIỮ `appointments.edit` để
--      tạo / xác nhận lịch ở trang Khách hàng, Booking, Khách tiềm năng — cùng bảng clinic_appointments
--      nên xác nhận ở Booking hiện luôn ở /appointments.
--   2. Sales: chỉ còn module Lịch hẹn (xem / sửa / xoá), bỏ Khách hàng + Dịch vụ.
-- Telesales Leader giữ nguyên. Chạy SAU 20261113150100_department_permissions.sql. Chạy lại an toàn.

update public.department_permissions
set permissions = array_remove(permissions, 'appointments.view')
where department = 'telesales';

update public.department_permissions
set permissions = array['appointments.view', 'appointments.edit', 'appointments.delete']
where department = 'sales';

-- Kiểm tra:
--   select department, permissions from public.department_permissions order by 1;
