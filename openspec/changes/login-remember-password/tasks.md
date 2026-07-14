# Tasks: login-remember-password

## 1. Frontend

- [x] 1.1 `components/auth/login-form.tsx` — checkbox `remember` (native input + RHF register, mặc định tick), prefill defaultValues từ `localStorage` key `lavian-login`, lưu/xoá creds ngay trước khi gọi `signIn` (thành công là redirect nên không lưu sau được chắc chắn)
- [x] 1.2 i18n `auth.rememberMe` vi/en/id

## 2. Kiểm chứng

- [x] 2.1 `tsc --noEmit` + eslint sạch, `next build` PASS; `next dev` + curl /login 200 có checkbox remember
- [ ] 2.2 Test tay trên trình duyệt: login tick → mở lại /login thấy prefill; login bỏ tick → form trống
