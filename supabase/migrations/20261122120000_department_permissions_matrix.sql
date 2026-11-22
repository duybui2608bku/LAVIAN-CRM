-- Mục đích: đặt lại quyền theo bộ phận cho hợp lý (ghi đè toàn bộ mảng quyền của từng bộ phận)
--           + thu hồi quyền bảng của role `anon` còn sót.
-- Thứ tự: SAU 20261122100000_treatment_cards.sql (cần key cards.*). Chạy lại an toàn.
-- Admin (profiles.role = 'admin') luôn toàn quyền, không nằm trong bảng này.
-- Sau khi chạy, admin vẫn chỉnh tiếp được ở /users → "Phân quyền".
--
-- Ma trận (Tài liệu /documents: mọi bộ phận, lọc theo từng tài liệu bằng RLS — không có key quyền):
--   Bộ phận           | Khách hàng | Lịch hẹn (Bán hàng)  | Thẻ LT    | Tour      | Dịch vụ | BC Telesales
--   telesales         | xem, sửa   | sửa (tạo/xác nhận)*  | —         | —         | xem     | —
--   telesales_leader  | xem,sửa,xoá| xem, sửa, xoá        | —         | —         | xem     | xem
--   sales             | —          | xem, sửa, xoá        | xem, sửa  | —         | —       | —
--   technician        | —          | —                    | —         | xem, sửa  | —       | —
--   * Telesales tạo / xác nhận lịch ở trang Khách hàng, Booking, Khách tiềm năng — không vào menu /appointments.
-- Thay đổi so với trước:
--   - technician: chỉ còn Tour (nhận tour, điền Lần/Bill, ảnh) — bỏ Khách hàng, Lịch hẹn, Dịch vụ, Thẻ, tour.delete
--     (KTV không tạo tour nên không cần xoá). Hệ quả: Master không còn vào /appointments để chọn "Đã thực hiện".
--   - telesales, telesales_leader: Dịch vụ (bảng giá) chỉ xem — thêm/sửa/xoá dịch vụ chỉ admin.
--   - Báo cáo, Marketing: chỉ admin (không bộ phận nào có).

update public.department_permissions set permissions = array[
  'customers.view', 'customers.edit', 'appointments.edit', 'services.view'
] where department = 'telesales';

update public.department_permissions set permissions = array[
  'customers.view', 'customers.edit', 'customers.delete',
  'appointments.view', 'appointments.edit', 'appointments.delete',
  'services.view', 'telesales.view'
] where department = 'telesales_leader';

update public.department_permissions set permissions = array[
  'appointments.view', 'appointments.edit', 'appointments.delete', 'cards.view', 'cards.edit'
] where department = 'sales';

update public.department_permissions set permissions = array[
  'tour.view', 'tour.edit'
] where department = 'technician';

-- `anon` (chưa đăng nhập) không dùng bảng nào: lead form công khai chạy server action bằng secret key.
-- RLS đã chặn anon (không có policy cho anon) — revoke để chặn cả khi sau này lỡ thêm policy thiếu `to authenticated`.
revoke all on public.customers, public.profiles, public.department_permissions,
  public.services, public.service_groups from anon;

-- Kiểm tra:
--   select department, permissions from public.department_permissions order by 1;
--   select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
--   where c.relkind = 'r' and has_table_privilege('anon', c.oid, 'select');   -- mong đợi: rỗng
