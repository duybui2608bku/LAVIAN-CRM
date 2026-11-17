## 1. Triển khai

- [x] 1.1 `fetchInboxThreads` nhận `{ byCreated, tags }`; phân trang theo ngày tạo bằng `dateRange`
- [x] 1.2 `buildInboxReport(created, booked)` + `conversations`; test
- [x] 1.3 Action gọi song song 2 truy vấn; view dùng `conversations` làm mẫu số; đổi nhãn i18n

## 2. Kiểm tra

- [x] 2.1 tsc + eslint + test
- [x] 2.2 Chạy thật với SMAX (17/11: 35 hội thoại mới, 10 booking / 9 khách cũ)
- [ ] 2.3 Xem trên trình duyệt
