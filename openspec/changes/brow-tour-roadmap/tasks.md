## 1. DB

- [x] 1.1 Migration `20261123140000_tour_roadmap_planned.sql`: cột `tours.planned`, check, RLS `tours_update` (+ `cards.edit` với tour dự kiến), RPC `journey_due_source` bỏ tour dự kiến

## 2. Logic

- [x] 2.1 `planRoadmap(items, tours)` + `ROADMAP_AREAS` trong `lib/cards.ts`; `journeyDue` bỏ tour dự kiến
- [x] 2.2 Test các kịch bản spec (`lib/cards.test.ts`)
- [x] 2.3 `lib/roadmap-sync.ts`: `syncRoadmap(db, cardId)` diff tại chỗ

## 3. Server actions

- [x] 3.1 Cards: đếm buổi bỏ dự kiến; gọi sync sau tạo tour, sửa số buổi, hoàn DV
- [x] 3.2 Tour: `claimTour` / `confirmTour` chặn dự kiến; sync sau `updateTour` / `deleteTour`; `confirmPlannedTour(id, date)`
- [x] 3.3 Trang Tour: Chờ nhận của KTV bỏ tour dự kiến

## 4. UI

- [x] 4.1 `tourStatus` = planned → tag "Dự kiến", lọc; Excel / phiếu / thống kê bỏ dự kiến
- [x] 4.2 Drawer tour dự kiến: ngày + nút Chốt lịch, ẩn Loại / KTV / ảnh / xác nhận
- [x] 4.3 Drawer thẻ: lộ trình hiện tour dự kiến (mờ + tag), đếm buổi bỏ dự kiến, nút "Sạch → lên mới" / "Còn mực +1 buổi"
- [x] 4.4 i18n vi/en

## 4b. Sửa ngày tour dự kiến

- [x] 4b.1 Migration `20261123150000_tour_planned_date_pinned.sql` (cột `date_pinned`)
- [x] 4b.2 `planRoadmap` nhận `pinned`; sync đọc `date_pinned`; `setPlannedTourDate`; sync sau `addCardItems`
- [x] 4b.3 Drawer Thêm dịch vụ: 760px, bảng giá 1 cột chữ nhỏ, mục Lộ trình dự kiến sửa ngày

## 4c. Lộ trình lúc bán thẻ

- [x] 4c.1 `planRoadmap(..., start)` khi chưa có tour thật; `cardPlanSchema`; `syncRoadmap(db, cardId, seed)`
- [x] 4c.2 `createCard` tạo tour dự kiến theo `plan`; `createCardTours` dùng lại tour dự kiến sớm nhất
- [x] 4c.3 Drawer Bán thẻ: xem trước lộ trình, sửa ngày

## 5. Kiểm tra

- [x] 5.1 tsc + eslint + node --test
- [x] 5.2 memory-bank
