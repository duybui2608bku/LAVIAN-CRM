## Why

Ô **Nguồn** (Sales Management, Booking Management, Khách hàng, Khách tiềm năng, drawer Thông tin khách) chỉ hiện 1 kênh. Khách hay nhắn IG trước rồi chuyển sang WhatsApp → Sales muốn thấy **cả 2 nguồn, mỗi nguồn 1 hàng** (IG + username, WA + số WA).

Hiện CRM **không lưu** kênh thứ hai: lead form tìm thấy khách theo SĐT từ hội thoại kênh khác thì giữ kênh nhắn trước (`keepChannel`) và bỏ qua hội thoại mới. Kiểm DB 2026-11-19: 0/167 khách có cả WA lẫn IG.

## What Changes

- DB `customers.other_channel jsonb` (null = chỉ 1 kênh): `{ source, link, username }` của kênh thứ hai (`source` = `whatsapp` | `instagrams`, `link` = link hội thoại SMAX, `username` = username IG nếu có).
- Lead form: khách tìm theo SĐT (`keepChannel`) mà hội thoại đang mở thuộc **kênh khác** `customers.source` → ghi `other_channel` (lần sau ghi đè bằng hội thoại mới nhất của kênh đó). Kênh chính không đổi.
- `SourceCell`: có kênh thứ hai khác kênh chính → 2 hàng (kênh chính trên). Mỗi hàng = icon + số WA (tag) hoặc username IG (link). Chỉ 1 kênh → như cũ.

## Impact

- Migration `supabase/migrations/20261119150000_customer_other_channel.sql` — chạy TRƯỚC khi deploy (các trang select `other_channel`).
- Sửa: `types/{customer,appointment}.ts`, `app/lead-form/actions.ts`, `app/(app)/customers/customers-view.tsx` (`CUSTOMER_LIST_FIELDS`), `app/(app)/appointments/page.tsx`, `app/(app)/customers/bookings/page.tsx`, `components/customers/customers-manager.tsx` (`SourceCell`).
- Khách cũ không tự có kênh thứ hai — chỉ có từ lần Telesales bấm Cập nhật ở hội thoại kênh còn lại.
