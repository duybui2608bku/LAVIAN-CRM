-- Mục đích: thêm cột icon (tên icon Lucide, kebab-case) + color (hex #rrggbb)
--           cho public.enum_options — admin cấu hình tag (icon + màu) ở /enums,
--           bảng khách hàng hiển thị Giai đoạn/Nguồn dưới dạng tag.
-- Thứ tự chạy: SAU 20260707140000_customers_and_enums.sql (cần bảng enum_options).
-- Idempotent — chạy lại an toàn. Dán vào Supabase SQL Editor chạy tay.

alter table public.enum_options
  add column if not exists icon text,
  add column if not exists color text;

-- Ràng buộc định dạng (drop trước để chạy lại an toàn)
alter table public.enum_options
  drop constraint if exists enum_options_icon_format,
  drop constraint if exists enum_options_color_format;

alter table public.enum_options
  add constraint enum_options_icon_format
    check (icon is null or icon ~ '^[a-z0-9-]+$'),
  add constraint enum_options_color_format
    check (color is null or color ~ '^#[0-9a-fA-F]{6}$');

-- Seed màu mặc định — chỉ khi color còn null (không đè lựa chọn admin).
update public.enum_options as e
set color = c.color
from (
  values
    ('stage',  'new_lead',   '#3b82f6'),
    ('stage',  'consulting', '#a855f7'),
    ('stage',  'deposited',  '#ca8a04'),
    ('stage',  'booked',     '#0ea5e9'),
    ('stage',  'visited',    '#14b8a6'),
    ('stage',  'returning',  '#22c55e'),
    ('stage',  'lost',       '#ef4444'),
    ('source', 'instagrams', '#ec4899'),
    ('source', 'whatsapp',   '#16a34a'),
    ('source', 'referral',   '#7b68ee'),
    ('source', 'walk_in',    '#f97316'),
    ('source', 'other',      '#6b7280'),
    ('lost_reason', 'too_expensive',        '#f97316'),
    ('lost_reason', 'wrong_number',         '#ef4444'),
    ('lost_reason', 'unreachable',          '#a855f7'),
    ('lost_reason', 'no_answer',            '#0ea5e9'),
    ('lost_reason', 'too_far',              '#14b8a6'),
    ('lost_reason', 'thinking_then_silent', '#ca8a04'),
    ('lost_reason', 'other',                '#6b7280')
) as c(kind, value, color)
where e.kind = c.kind
  and e.value = c.value
  and e.color is null;

-- Seed icon Lucide mặc định (kebab-case) — chỉ khi icon còn null.
-- Lưu ý: Lucide đã bỏ icon thương hiệu (không có "instagram"/"whatsapp") → dùng icon gần nghĩa.
update public.enum_options as e
set icon = c.icon
from (
  values
    ('stage',  'new_lead',   'user-plus'),
    ('stage',  'consulting', 'messages-square'),
    ('stage',  'deposited',  'piggy-bank'),
    ('stage',  'booked',     'calendar-check'),
    ('stage',  'visited',    'map-pin-check'),
    ('stage',  'returning',  'repeat'),
    ('stage',  'lost',       'user-x'),
    ('source', 'instagrams', 'camera'),
    ('source', 'whatsapp',   'message-circle'),
    ('source', 'referral',   'handshake'),
    ('source', 'walk_in',    'footprints'),
    ('source', 'other',      'circle-ellipsis'),
    ('lost_reason', 'too_expensive',        'circle-dollar-sign'),
    ('lost_reason', 'wrong_number',         'phone-off'),
    ('lost_reason', 'unreachable',          'phone-missed'),
    ('lost_reason', 'no_answer',            'message-square-x'),
    ('lost_reason', 'too_far',              'map-pin-off'),
    ('lost_reason', 'thinking_then_silent', 'hourglass'),
    ('lost_reason', 'other',                'circle-ellipsis')
) as c(kind, value, icon)
where e.kind = c.kind
  and e.value = c.value
  and e.icon is null;
