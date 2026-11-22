## 1. Logic (lib/cards.ts + test)

- [x] 1.1 Hằng số `LASER_CHECK_DAYS = 20`, `RETOUCH_DAYS = 45`
- [x] 1.2 `suggestTourKind(service, itemTours)` + `tourKindDetail(kind, date, others)` (tính `service_detail` + `service_session`), thay `tourDetailFor`
- [x] 1.3 `journeyDue(cards, tours)` → mục Kiểm tra laser / Dặm + ngày hạn (quá hạn / hôm nay / sắp tới tính ở UI)
- [x] 1.4 `cardTourSchema.items[].kind`, `cardItemSessionsSchema`; test các kịch bản trong spec

## 2. Server actions

- [x] 2.1 `createCardTours` nhận Loại, tự tính số lần theo tour hiện có của dòng
- [x] 2.2 `updateCardItemSessions(itemId, sessions)` — `cards.edit`, ≥ số tour đã có, dòng chưa hoàn, thẻ chưa huỷ
- [x] 2.3 Drawer tour đổi Loại → `updateTour` nhận `kind`, server tính `service_detail` + số lần

## 3. UI

- [x] 3.1 Nhãn Loại (Laser n / Làm mới / Dặm n) thay "Lần n": bảng tour, thẻ KTV, lộ trình trong thẻ, Excel, phiếu tour
- [x] 3.2 Modal Tạo tour từ thẻ: chọn Loại mỗi dòng (gợi ý sẵn) thay ô Lần
- [x] 3.3 Drawer tour: ô Loại thay ô Lần
- [x] 3.4 Drawer thẻ: sửa số buổi cạnh "x/y buổi"
- [x] 3.5 `/cards` tab "Đến hạn (N)": bảng + lọc trạng thái + lọc Sales (mặc định mình nếu không phải admin)
- [x] 3.6 i18n vi/en

## 4. Kiểm tra

- [x] 4.1 tsc + eslint + node --test
- [ ] 4.2 Xem trên trình duyệt (cần đăng nhập)
- [ ] 4.3 memory-bank + hướng dẫn Thẻ liệu trình (mục Đến hạn, sửa số buổi)
