# Design: public-lead-form-smax

## Context

SMAX "Nhúng form" nhúng 1 public URL dưới dạng iframe trong khung chat (tài liệu: tailieu.smax.ai/module-cai-dat/tich-hop/nhung-form). Giao tiếp 2 chiều qua `window.postMessage`:

- Form → SMAX: `{name:'__SM_FORM_CUSTOMER', data:{integration_id}}` để xin dữ liệu khách; `integration_id` lấy từ query param URL.
- SMAX → Form: event `message` với `data.name === '__SM_FORM_CUSTOMER'`, `data.data.customer = {id, name, address, phone, email, gender, gid, picture}`.
- Form → SMAX: `{name:'__SM_FORM_POPUP', action:'SHOW'|'HIDE', data:{integration_id,...}}` bật/tắt popup.

CRM hiện tại: mọi RLS bảng `customers` chỉ cho `authenticated`; form public là anonymous → không ghi trực tiếp được. Đã có `lib/supabase/admin.ts` (secret key, server-only).

## Goals / Non-Goals

**Goals:**
- 1 trang public `/lead-form` nhúng được SMAX iframe, tự đứng độc lập (không app shell), điền được cả khi mở trực tiếp (không nhúng).
- Submit tạo customer mới: stage `new_lead`, source mặc định `smax`, ghi chú (nếu có) + dấu vết SMAX vào `notes`.
- Prefill tên/SĐT từ SMAX; nút đóng popup sau khi gửi thành công.

**Non-Goals (YAGNI):**
- Không dedupe theo phone (CRM cho phép trùng by design — nhân viên tự gộp).
- Không rate-limit server (honeypot là đủ cho iframe SMAX; thêm khi bị spam thật).
- Không form builder/nhiều form cấu hình được — 1 form cứng.
- Không chọn dịch vụ/nhân viên trên form public (khách không cần biết nội bộ).

## Decisions

1. **Ghi DB bằng admin client trong Server Action** (`app/lead-form/actions.ts` — `submitLead`), KHÔNG mở RLS anon-insert. Lý do: giữ nguyên mô hình RLS hiện tại; server action whitelist đúng 4 cột ghi (full_name, phone, source, first_contact + stage/notes server đặt) — client không điều khiển được gì khác. Secret key vẫn server-only (đúng CLAUDE.md).
2. **Validate zod ngay trong action** (trust boundary): full_name 1–120 ký tự, phone 8–15 ký tự `[0-9+ ().-]`, note ≤ 1000, source override qua `?source=` phải khớp `^[a-z0-9_]{1,50}$` (định dạng value của enum_options) — sai thì rơi về `smax`. Honeypot: field ẩn `website` có giá trị → trả success giả, không insert.
3. **`/lead-form` public nhưng KHÔNG redirect người đã đăng nhập**: proxy tách `AUTH_PAGES` (login/banned — đã đăng nhập thì đá về `/`) khỏi `PUBLIC_PATHS` (thêm `/lead-form`). Nhân viên đang đăng nhập vẫn mở/test được form. Next.js không set X-Frame-Options mặc định → iframe hoạt động, không cần header gì thêm.
4. **SMAX chỉ chạy khi thực sự nhúng** (`window.parent !== window`): mount → gửi xin `__SM_FORM_CUSTOMER` (integration_id từ `useSearchParams`); listener chỉ prefill ô còn TRỐNG (không đè người dùng đang gõ); giữ `{id, name}` của khách SMAX → ghi thành 1 dòng trong note ("Từ SMAX: {name} (id ...)") để nhân viên trace. Thành công → hiện màn hình cảm ơn + nút Đóng gửi `__SM_FORM_POPUP HIDE` (chỉ hiện khi nhúng); không auto-HIDE để khách kịp thấy xác nhận.
5. **`first_contact` = ngày hiện tại theo Asia/Ho_Chi_Minh** (`toLocaleDateString("en-CA", {timeZone})` → `YYYY-MM-DD`) — server UTC không bị lệch ngày lúc sáng sớm (bài học `localDay` của appointments).
6. **Note stamp `by: "Form SMAX"`** (snapshot string như CustomerNote.by hiện có — không phải user thật, avatar fallback tự xử lý).
7. **Seed migration riêng** `20260714090000_seed_source_smax.sql`: insert `('source','smax','SMAX','SMAX','SMAX', 45, icon 'message-square', color '#0084ff')` với `on conflict (kind, value) do nothing` (pattern migration gốc). sort_order 45 = giữa walk_in(40) và other(50).
8. **UI**: trang đứng ngoài `(app)` (kế thừa root layout + providers, không sidebar/header): card giữa trang, logo, 3 field (mỗi field 1 hàng — pattern form drawer), shadcn Input/Textarea/Label/Button có sẵn; client component `components/lead-form/lead-form.tsx` dùng react-hook-form + zod + `useTranslations("leadForm")` như các manager hiện có.

## Risks / Trade-offs

- [Public endpoint ai cũng POST được] → zod + honeypot + whitelist cột; không rate-limit (ghi rõ, nâng khi cần).
- [Trùng khách khi khách gửi nhiều lần] → chấp nhận (CRM cho phép trùng); note SMAX id giúp nhận ra.
- [SMAX đổi giao thức postMessage] → toàn bộ tích hợp gói trong 1 effect của lead-form.tsx, form vẫn dùng được như form thường nếu SMAX im lặng.
- [`?source=` cho phép giá trị lạ] → regex giới hạn định dạng; giá trị không có trong enum_options chỉ hiện badge giá trị thô ở /customers (hành vi sẵn có).
