-- Người thực sự nhận/phụ trách khoản thanh toán, có thể khác tài khoản nhập liệu.
-- `created_by` tiếp tục là dấu vết tài khoản đang đăng nhập đã tạo dòng.
alter table public.appointment_payments
  add column if not exists received_by uuid references public.profiles(id) on delete set null;

-- Dữ liệu cũ chưa có lựa chọn riêng: giữ nguyên cách hiểu trước đây.
update public.appointment_payments
set received_by = created_by
where received_by is null;

create index if not exists appointment_payments_received_by_idx
  on public.appointment_payments (received_by);
