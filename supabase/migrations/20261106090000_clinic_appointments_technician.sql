-- Lịch hẹn: tách người phụ trách thành 2 cột.
--   staff_id      → Chăm sóc khách hàng (department = 'customer_care')
--   technician_id → Kỹ thuật viên       (department = 'technician')
-- Chạy sau 20261031065602_clinic_appointments.sql. Chạy lại an toàn.
-- RLS/grant của bảng đã áp dụng cho mọi cột, không cần đổi.

alter table public.clinic_appointments
  add column if not exists technician_id uuid references public.profiles(id) on delete set null;

-- Dời dữ liệu cũ: staff_id đang gán cho kỹ thuật viên → chuyển sang technician_id.
update public.clinic_appointments a
set technician_id = a.staff_id, staff_id = null
from public.profiles p
where p.id = a.staff_id and p.department = 'technician' and a.technician_id is null;
