# Tasks: lead-form-ig-phone-optional

## 1. Backend

- [x] 1.1 `phoneOptional(source)` trong `lib/customer-options.ts`; `phoneOwner('')` → null
- [x] 1.2 Lead form server: nhận SĐT rỗng, chặn thiếu SĐT khi nguồn WA, cập nhật để trống thì giữ SĐT cũ
- [x] 1.3 `/customers` `updateCustomer`: khách IG được để trống SĐT

## 2. Frontend

- [x] 2.1 Lead form: ô SĐT không bắt buộc + placeholder khi nguồn IG
- [x] 2.2 Drawer khách hàng: sửa khách IG không bắt buộc SĐT

## 3. Database

- [x] 3.1 Unique index SĐT (migration `20261119100000`, chưa chạy) bỏ qua `phone = ''` — sửa file, chưa chạy (chờ dọn cặp trùng)

## 4. Kiểm chứng

- [x] 4.1 tsc + eslint + 92 test sạch
- [ ] 4.2 Test tay lead form trong SMAX (hội thoại IG, để trống SĐT)
