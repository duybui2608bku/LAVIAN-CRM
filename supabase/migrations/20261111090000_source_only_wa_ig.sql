-- Mục đích: nguồn khách chỉ còn 2 loại — WhatsApp ('whatsapp') và Instagram ('instagrams').
--   * Khách có hội thoại WhatsApp (thread.link chứa '/chats/waw<số>') → 'whatsapp', còn lại → 'instagrams'.
--   * Lịch hẹn: đồng bộ source theo khách.
--   * Ẩn (is_active = false) các option nguồn khác trong enum_options.
--   * Cột customers.source mặc định 'instagrams'.
-- Thứ tự chạy: sau 20261107090000_source_smax_to_instagram.sql.
-- Idempotent — chạy lại an toàn. Dán vào Supabase SQL Editor chạy tay.

update public.customers
set source = case when thread->>'link' ~ '/chats/waw[0-9]' then 'whatsapp' else 'instagrams' end
where source is distinct from
      case when thread->>'link' ~ '/chats/waw[0-9]' then 'whatsapp' else 'instagrams' end;

update public.appointments a
set source = c.source
from public.customers c
where c.id = a.customer_id
  and a.source is distinct from c.source;

update public.enum_options
set is_active = false
where kind = 'source'
  and value not in ('whatsapp', 'instagrams')
  and is_active;

alter table public.customers alter column source set default 'instagrams';
