## 1. Database
- [x] 1.1 Cột `notifications.ref` + index + unique index digest
- [x] 1.2 `notify_users()` (lọc active, bỏ actor, bỏ đã nhận, thay bản chưa đọc cùng ref)
- [x] 1.3 Trigger lịch hẹn (`clinic_appointments`)
- [x] 1.4 Trigger tour (`tours`) + gỡ "chờ nhận"
- [x] 1.5 Trigger thẻ (`treatment_cards`, `treatment_card_payments`, `treatment_card_items`)
- [x] 1.6 Trigger tài liệu (`documents`, `document_comments`)
- [x] 1.7 RPC `notify_journey_digest()`
- [x] 1.8 Thử trên DB thật trong khối rollback (chưa thử: huỷ/hoàn/bán thẻ, huỷ lịch, huỷ tour)

## 2. App
- [x] 2.1 `lib/notifications.ts`: ánh xạ kind → chữ / icon, gộp theo ref (+test)
- [x] 2.2 Chuông: toast khi có thông báo mới, gộp ref
- [x] 2.3 `ensureJourneyDigest` gọi 1 lần / ngày / trình duyệt
- [x] 2.4 i18n vi / en
- [x] 2.5 tsc + eslint + test
