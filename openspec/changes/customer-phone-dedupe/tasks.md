# Tasks: customer-phone-dedupe

## 1. Backend

- [x] 1.1 `phoneOwner()` trong `lib/customers.ts`
- [x] 1.2 `createCustomer` / `updateCustomer` chặn trùng SĐT; `createAppointment` dùng helper
- [x] 1.3 Lead form: `findLeadRow` dò SMAX id → SĐT; cập nhật theo id, khách tìm theo SĐT giữ trường kênh; chặn đổi sang SĐT của khách khác

## 2. Frontend

- [x] 2.1 Lead form gửi kèm SĐT khi kiểm tra khách cũ

## 3. Database

- [ ] 3.1 Migration `20261119100000_customer_phone_unique.sql` (chạy SAU khi xử lý cặp trùng hiện có)

## 4. Kiểm chứng

- [x] 4.1 tsc + eslint + 96 test sạch
- [ ] 4.2 Test tay lead form trong SMAX (khách IG → WA)
