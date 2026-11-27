## 1. Sửa

- [x] 1.1 B3: `refund_treatment_card` xoá mềm tour Chờ nhận; `tours_card_guard` chặn nhận tour của thẻ huỷ / hoàn (`card_cancelled`); câu báo `tour.cardClosed`; câu xác nhận Hoàn thẻ
- [x] 1.2 B6: `plannedDateError` + kiểm trong `setPlannedTourDate`; i18n `plannedPast` / `plannedBeforePrev` / `plannedAfterNext`
- [x] 1.3 B8: `duplicateKey` ở lead-form; i18n `phoneTaken` / `smaxTaken` / `duplicateRecord`

## 2. Kiểm tra

- [x] 2.1 tsc + eslint + `node --test`
- [x] 2.2 Chạy migration `20261127140000` trên DB và kiểm
- [ ] 2.3 Xem trên trình duyệt
