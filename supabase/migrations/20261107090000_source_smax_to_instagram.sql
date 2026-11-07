-- Mục đích: bỏ nguồn khách 'smax'. Dữ liệu cũ có source = 'smax' (khách tạo từ
--           Form SMAX trước đây) chuyển hết về 'instagrams'; xoá option 'smax'
--           khỏi enum_options (seed bởi 20260714090000_seed_source_smax.sql).
-- Thứ tự chạy: sau 20260714090000_seed_source_smax.sql và 20260710130000_appointments.sql.
-- Idempotent — chạy lại an toàn (lần 2 không còn dòng nào khớp).
-- Dán vào Supabase SQL Editor chạy tay.

update public.customers    set source = 'instagrams' where lower(source) = 'smax';
update public.appointments set source = 'instagrams' where lower(source) = 'smax';

delete from public.enum_options where kind = 'source' and value = 'smax';
