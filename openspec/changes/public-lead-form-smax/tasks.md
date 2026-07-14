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

## 5. Theme + ngôn ngữ (bổ sung sau)

- [x] 5.1 `proxy.ts` — `/lead-form` chưa có cookie `NEXT_LOCALE` → override cookie request = `en` (chỉ request, không ghi response; route khác giữ mặc định `vi`)
- [x] 5.2 `app/lead-form/page.tsx` — gắn `ThemeToggle` + `LanguageSwitcher` góc trên phải; script inline ép mặc định light khi localStorage `theme` chưa có (ghi `theme=light` để next-themes hydrate đúng)

## 6. Select nhân viên + bỏ note "Từ SMAX" (bổ sung sau)

- [x] 6.1 `app/lead-form/actions.ts` — bỏ field `smax` + note dấu vết "Từ SMAX"; thêm `staff_id` (uuid hoặc rỗng) ghi vào insert
- [x] 6.2 `app/lead-form/page.tsx` — query profiles active (admin client) truyền prop `staff`
- [x] 6.3 `components/lead-form/lead-form.tsx` — bỏ state smax; thêm select nhân viên (ClearableSelect + Controller, ẩn khi danh sách rỗng); i18n key `leadForm.staff` vi/en/id

## 7. Tự nạp lại khách SMAX khi đổi khách (bổ sung sau)

- [x] 7.1 `components/lead-form/lead-form.tsx` — helper `requestCustomer` (postMessage __SM_FORM_CUSTOMER) + poll 3s khi embedded; ref `smaxIdRef` so id khách: event đầu prefill ô trống, id đổi → nạp lại tên/SĐT theo khách mới, id giữ nguyên → không đụng form; nút "Gửi thông tin khác" reset ref + xin lại để prefill khách đang mở. (Bản đầu là nút reload thủ công — đã bỏ theo feedback, gỡ luôn i18n `leadForm.reload`)

## 8. Kiểm chứng

- [x] 8.1 `tsc --noEmit`, eslint file sửa, `next build` PASS; test tay flow submit nếu chạy được dev — đã chạy `next start`: GET /lead-form 200 (anonymous, đúng nội dung), /customers vẫn 307 → /login; insert payload thật vào customers qua admin key OK (dòng test đã xóa)
- [x] 8.2 Theme+ngôn ngữ: `next dev` + curl — /lead-form ẩn danh ra `lang="en"` + script light; cookie `NEXT_LOCALE=vi` ra `lang="vi"`; /login ẩn danh vẫn `lang="vi"`
- [x] 8.3 Mục 6: `tsc --noEmit` + eslint sạch, `next build` PASS; `next dev` + curl: /lead-form 200, select nhân viên render (label Consultant), không còn dấu vết note SMAX
- [x] 8.4 Mục 7: `tsc --noEmit` + eslint file sửa sạch
