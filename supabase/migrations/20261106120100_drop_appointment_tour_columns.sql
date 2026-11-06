-- Lịch hẹn chỉ còn lưu lịch đến của khách: bỏ các cột tour cũ (đã chép sang public.tours).
-- CHẠY SAU khi đã chạy 20261106120000_tours.sql VÀ đã deploy code mới (code cũ còn đọc các cột này).
-- Chạy lại an toàn.

alter table public.clinic_appointments
  drop constraint if exists clinic_appointments_service_detail_check,
  drop constraint if exists clinic_appointments_bill_amount_check,
  drop column if exists payment_method,
  drop column if exists technician_id,
  drop column if exists service_detail,
  drop column if exists service_session,
  drop column if exists bill_amount;
