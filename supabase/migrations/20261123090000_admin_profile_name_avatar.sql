-- Mục đích: tài khoản admin@lavian.com có user_name rỗng + avatar_url null → UI hiện "—".
-- Đặt tên "Admin" và avatar = logo Lavian tròn (public/icons/icon-192.png, phục vụ tĩnh, không qua proxy).
-- Chỉ ghi đè khi đang trống → chạy lại an toàn, không đè nếu admin đã tự đổi trong "Hồ sơ".
-- Không phụ thuộc migration khác (chỉ cần bảng public.profiles).

update public.profiles
set user_name  = coalesce(nullif(btrim(user_name), ''), 'Admin'),
    avatar_url = coalesce(nullif(btrim(avatar_url), ''), '/icons/icon-192.png')
where email = 'admin@lavian.com';
