# Proposal: public-lead-form-smax

## Why

Khách nhắn tin qua SMAX (livechat Facebook) hiện phải được nhân viên nhập tay vào CRM. SMAX hỗ trợ "Nhúng form" — một public URL nhúng iframe ngay trong khung chat, tự bơm sẵn thông tin khách qua `postMessage`. Cần 1 form public để khách/nhân viên chat điền → tạo ngay khách hàng mới trong Supabase, không cần đăng nhập CRM.

## What Changes

- Trang form public mới `/lead-form` (không cần đăng nhập, nhúng được iframe): họ tên + SĐT bắt buộc, ghi chú tùy chọn.
- Submit → Server Action `submitLead` tạo `customers` mới bằng **admin client** (anonymous không qua được RLS): `stage='new_lead'`, `source` mặc định `'smax'` (đổi được qua query `?source=`), ghi chú append vào `notes` kèm dấu vết SMAX (id/name).
- Tích hợp SMAX theo tài liệu: form gửi `__SM_FORM_CUSTOMER` xin dữ liệu khách → prefill tên/SĐT; sau khi tạo thành công gửi `__SM_FORM_POPUP` action `HIDE` đóng popup.
- `proxy.ts`: `/lead-form` thành route public, KHÔNG redirect người đã đăng nhập (khác /login, /banned).
- Migration seed enum `source` giá trị `smax` (idempotent, chạy tay).
- i18n namespace `leadForm` (vi/en/id).

## Capabilities

### New Capabilities
- `public-lead-form`: form public tạo khách hàng mới, tích hợp nhúng SMAX.

### Modified Capabilities

(Không — customers/enums giữ nguyên requirement; chỉ seed thêm 1 giá trị source.)

## Impact

- Thêm: `app/lead-form/{page.tsx,actions.ts}`, `supabase/migrations/20260714090000_seed_source_smax.sql`.
- Sửa: `proxy.ts` (public path), `messages/{vi,en,id}.json`.
- Bảo mật: secret key chỉ dùng trong Server Action (server-only); form public cần validate đầu vào + honeypot chống spam. Không đổi RLS.
