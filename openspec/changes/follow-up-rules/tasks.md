# Tasks: follow-up-rules

## 1. Database

- [x] 1.1 Migration `20261119090000_follow_up_rules.sql`: bỏ `considering`, constraint `customers_follow_up_required`, trigger `customers_track_conversion`

## 2. Backend

- [x] 2.1 `lib/customer-options.ts`: bỏ option `considering`
- [x] 2.2 `CustomerInput.follow_up_at`; `clean()` + `patchCustomer` bắt buộc lịch nhắc khi stage Tiềm năng/Cân nhắc
- [x] 2.3 `CUSTOMER_LIST_FIELDS` thêm `follow_up_at` (drawer điền sẵn)

## 3. Frontend

- [x] 3.1 `/customers` ô stage inline: chọn Tiềm năng/Cân nhắc → Modal chọn lịch nhắc
- [x] 3.2 Drawer khách: ô "Lịch nhắc follow-up" bắt buộc khi stage Tiềm năng/Cân nhắc

## 4. Kiểm chứng

- [x] 4.1 tsc + eslint + 96 test sạch
- [x] 4.2 Chạy migration trên Supabase Lavian (2026-11-19; trước đó thử 6 tình huống trong khối rollback — đúng hết)
- [ ] 4.3 Test tay trên trình duyệt
