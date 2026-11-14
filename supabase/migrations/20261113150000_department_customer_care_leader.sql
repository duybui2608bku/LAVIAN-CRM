-- Migration: thêm bộ phận "Customer care leader" (OpenSpec: department-permissions)
--
-- Mục đích: thêm giá trị `customer_care_leader` vào enum public.user_department.
-- Thứ tự: chạy file này TRƯỚC 20261113150100_department_permissions.sql.
-- Tách riêng vì Postgres không cho dùng giá trị enum mới trong cùng transaction vừa thêm nó.
-- Chạy lại an toàn (if not exists).

alter type public.user_department add value if not exists 'customer_care_leader';
