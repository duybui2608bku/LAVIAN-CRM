-- Index cho 5 khoá ngoại Supabase advisor báo thiếu (lint 0001_unindexed_foreign_keys).
-- Hiện bảng còn nhỏ nên không đổi tốc độ thấy được; thêm sẵn để lọc theo người phụ trách
-- và xoá/đổi profile không phải quét cả bảng khi dữ liệu lớn.
-- Chạy độc lập, chạy lại an toàn.

create index if not exists clinic_appointments_sales_id_idx on public.clinic_appointments (sales_id);
create index if not exists clinic_appointments_created_by_idx on public.clinic_appointments (created_by);
create index if not exists tours_created_by_idx on public.tours (created_by);
create index if not exists tours_confirmed_by_idx on public.tours (confirmed_by);
create index if not exists profiles_department_idx on public.profiles (department);
