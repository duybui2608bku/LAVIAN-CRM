-- Mục đích: seed giá trị nguồn 'smax' cho public.enum_options — form public
--           /lead-form (nhúng SMAX livechat) gán source mặc định cho khách mới.
-- Thứ tự chạy: SAU 20260708090000_enum_options_icon_color.sql (cần cột icon/color).
-- Idempotent — chạy lại an toàn (không đè label/màu admin đã sửa).
-- Dán vào Supabase SQL Editor chạy tay.

insert into public.enum_options
  (kind, value, label_vi, label_en, label_id, icon, color, sort_order)
values
  ('source', 'smax', 'SMAX', 'SMAX', 'SMAX', 'message-square', '#0084ff', 45)
on conflict (kind, value) do nothing;
