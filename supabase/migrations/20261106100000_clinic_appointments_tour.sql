-- Lịch hẹn: Dịch vụ chi tiết (+ số lần) và Bill để tính tour kỹ thuật viên.
--   service_detail : laser | plasma | new | debt | retouch
--   service_session: 1–10 cho laser/plasma/retouch; null cho new/debt
--   bill_amount    : tiền bill (Rupiah, số nguyên >= 0)
-- Tỷ lệ tour tính trong code (lib/appointments.ts), không lưu DB.
-- Chạy sau 20261106090000_clinic_appointments_technician.sql. Chạy lại an toàn.

alter table public.clinic_appointments
  add column if not exists service_detail text,
  add column if not exists service_session smallint,
  add column if not exists bill_amount bigint;

alter table public.clinic_appointments
  drop constraint if exists clinic_appointments_service_detail_check,
  drop constraint if exists clinic_appointments_bill_amount_check;

alter table public.clinic_appointments
  add constraint clinic_appointments_service_detail_check check (
    (service_detail is null and service_session is null)
    or (service_detail in ('new', 'debt') and service_session is null)
    or (service_detail in ('laser', 'plasma', 'retouch') and service_session between 1 and 10)
  ),
  add constraint clinic_appointments_bill_amount_check check (bill_amount is null or bill_amount >= 0);
