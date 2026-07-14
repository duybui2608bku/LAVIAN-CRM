# Tasks: public-lead-form-smax

## 1. DB

- [x] 1.1 Migration `supabase/migrations/20260714090000_seed_source_smax.sql` — seed enum_options source 'smax' (label/icon/màu, sort 45, on conflict do nothing)

## 2. Backend

- [x] 2.1 `app/lead-form/actions.ts` — server action `submitLead` (zod validate, honeypot, admin client insert customers + note, first_contact theo Asia/Ho_Chi_Minh)

## 3. Frontend

- [x] 3.1 `components/lead-form/lead-form.tsx` — client form (rhf+zod, mỗi field 1 hàng, màn hình cảm ơn) + tích hợp SMAX postMessage (xin/nhận __SM_FORM_CUSTOMER prefill ô trống, nút Đóng gửi __SM_FORM_POPUP HIDE khi nhúng)
- [x] 3.2 `app/lead-form/page.tsx` — trang public đứng ngoài (app), card giữa trang + logo, metadata title
- [x] 3.3 i18n namespace `leadForm` vi/en/id

## 4. Routing

- [x] 4.1 `proxy.ts` — tách AUTH_PAGES khỏi PUBLIC_PATHS, thêm `/lead-form` public không redirect khi đã đăng nhập

## 5. Kiểm chứng

- [x] 5.1 `tsc --noEmit`, eslint file sửa, `next build` PASS; test tay flow submit nếu chạy được dev — đã chạy `next start`: GET /lead-form 200 (anonymous, đúng nội dung), /customers vẫn 307 → /login; insert payload thật vào customers qua admin key OK (dòng test đã xóa)
