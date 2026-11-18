# Tasks: bookings-lock-stage-columns

## 1. Frontend

- [x] 1.1 `components/customers/customers-manager.tsx` — `stages` có giá trị → InlineSelect Stage `disabled`; `CustomerDialog` prop `lockStage` khoá ô Stage khi sửa và gửi lại `editing.stage`
- [x] 1.2 Sắp cột khi có `stages`: key `appointment` lên đầu, key `created` xuống cuối

## 2. Kiểm chứng

- [x] 2.1 `tsc --noEmit` + eslint sạch
- [ ] 2.2 Xem tay `/customers/bookings` và `/customers`
