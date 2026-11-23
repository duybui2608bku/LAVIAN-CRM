## Context

- Thẻ liệu trình: mỗi nhóm chỉ 1 DV tạo tour / thẻ (trigger `treatment_card_items_group_guard`) → vùng mày có tối đa 1 dòng Laser (nhóm `laser`) + 1 dòng Alis. `sessions` của dòng sửa được (`updateCardItemSessions`, ≥ số tour đã có).
- Tour gắn dòng thẻ (`card_item_id`), Loại ở `service_detail` + `service_session` (`tourKindDetail`). `journeyDue` (Đến hạn) tự tính từ thẻ + tour.
- RLS hiện tại: Sales (`cards.edit`) **tạo** tour được nhưng **không sửa** được (update cần `tour.edit | tour.delete`).
- Trigger `tours_card_guard`: non-admin không đổi `card_item_id / customer_id / service_id` của tour → sinh lại phải giữ tour dự kiến trên đúng dòng DV của nó.
- Sếp chốt 2026-11-23: Laser → Laser 20 ngày; Laser cuối → Làm mới 20 ngày; Làm mới → Dặm 45 ngày, dặm 1 lần (= Alis 2 buổi); làm mày trước.

## Goals / Non-Goals

**Goals:** thấy trước cả lộ trình mày với ngày dự kiến; lộ trình tự đúng lại khi số buổi laser thực tế khác dự kiến hoặc khách dời lịch; KTV không bị ngập tour ảo.

**Non-Goals:** môi / mí (sau); tự nhắn khách; cron; tự chốt lịch khi tới ngày; sinh lộ trình khi thẻ chưa có tour thật nào.

## Decisions

1. **Lưu tour dự kiến thành dòng `tours` với `planned = true`** (không phải danh sách ảo) — sếp muốn thấy tour thật trong bảng Tour theo ngày, CSKH chốt từng cái. Alternative "chỉ hiển thị ảo" nhẹ hơn nhưng không hiện trong bảng Tour / không chốt lịch được.
   - DB check `tours_planned_check`: `not planned or (technician_id is null and confirmed_at is null)`.

2. **Số laser dự kiến = `sessions` của dòng Laser** — không thêm cột. Laser (once) = 1, full treatment = Sales nhập. "Sạch" / "Còn mực" chỉ là nút tắt sửa `sessions` (= đã làm / + 1).

3. **Hàm thuần `planRoadmap(items, tours)`** (`lib/cards.ts`, có test) — đầu vào: dòng DV của 1 thẻ chưa huỷ + tour **thật** của thẻ; đầu ra: danh sách `{ card_item_id, service_id, kind, tour_date }`. Mỗi vùng trong `ROADMAP_AREAS = ["alis"]`:
   - Neo = tour thật cuối cùng của vùng (sắp như `journeyDue`: cùng ngày thì laser trước). Chưa có → không sinh.
   - Khoảng cách chỉ phụ thuộc **Loại bước trước**: sau Laser/Plasma = 20 ngày, sau Làm mới/Dặm = 45 ngày.
   - Chưa có tour Làm mới: thêm (sessions Laser − laser đã làm) tour Laser, rồi Làm mới nếu Alis còn buổi; tiếp theo Dặm cho tới hết buổi Alis.
   - Đã có Làm mới: chỉ thêm Dặm cho tới hết buổi Alis (laser thừa bỏ qua).
   - Dòng đã hoàn / DV không tạo tour bỏ qua.

4. **Sinh lại = diff tại chỗ** (`syncRoadmap(db, cardId)` trong `lib/roadmap-sync.ts`, server-only): theo từng dòng DV, so tour dự kiến hiện có (sắp theo ngày) với danh sách mong muốn: cập nhật ngày / Loại nếu khác, thêm phần thiếu, xoá mềm phần thừa. Không đổi `card_item_id` (khớp guard), ít dòng nhật ký thẻ. Thẻ huỷ → xoá mềm hết tour dự kiến. Số lần (`service_session`) tính bằng `tourKindDetail` trên tour thật + bước dự kiến trước đó.
   - Gọi sau: `createCardTours`, `updateCardItemSessions`, `refundCardItem`, `updateTour` (đổi ngày / Loại), `deleteTour`, `confirmPlannedTour`. `cancelCard` không cần: thẻ còn tour thì không huỷ được (tour dự kiến chỉ có khi đã có tour thật). Tour dự kiến không sửa / xoá tay (`updateTour` / `deleteTour` lọc `planned = false`). Dùng client của người dùng (giữ actor trong nhật ký).

5. **RLS `tours_update`**: thêm nhánh `cards.edit` khi dòng cũ là dự kiến (`using planned`), `with check` dòng mới chưa KTV + chưa xác nhận. Sales sinh lại / chốt lịch được, không sửa được tour thật.

6. **Chốt lịch** `confirmPlannedTour(id, date)` — quyền `tour.edit | cards.edit`; chỉ tour dự kiến **sớm nhất** của thẻ (không nhảy bước); đặt `planned = false`, `tour_date = date` → sync.
   - `claimTour` thêm `planned = false`; trang Tour: danh sách Chờ nhận của KTV bỏ tour dự kiến; `tourStatus` thêm `planned` (tag "Dự kiến", lọc được); Excel / phiếu / thống kê tháng bỏ tour dự kiến.
   - Drawer tour dự kiến: chỉ xem + ô ngày + nút Chốt lịch (Loại / KTV / ảnh / xác nhận ẩn); admin vẫn xoá được (xoá → sync sinh lại nếu còn thiếu — chấp nhận, muốn bỏ hẳn bước thì giảm số buổi).

7. **Đếm buổi / Đến hạn bỏ tour dự kiến**: `usageOf` (drawer thẻ, 360°), modal Tạo tour, `createCardTours`, `updateCardItemSessions`, `journeyDue` (lọc `planned`), RPC `journey_due_source` (`and not t.planned`).

8. **Sửa ngày tour dự kiến** (drawer Thêm dịch vụ, mục "Lộ trình dự kiến"): `setPlannedTourDate(id, date)` (quyền `tour.edit | cards.edit`) lưu ngày + `tours.date_pinned = true`; `planRoadmap(items, tours, pinned)` giữ ngày đã ghim của bước thứ k mỗi dòng DV, các bước sau tính tiếp từ đó. `addCardItems` cũng gọi sync (bán thêm mày / laser). Drawer Thêm dịch vụ thu còn 760px: bảng giá 1 cột chữ nhỏ.

9. **Lộ trình lúc bán thẻ**: drawer Bán thẻ (`previewRoadmap`) xem trước `planRoadmap(DV đang chọn, [], pins, start)` — bước đầu = ngày bắt đầu (mặc định hôm nay), sửa được từng ngày. `createCard` nhận `plan { start, pins[service_id, k, date] }` → `syncRoadmap(db, cardId, plan)` tạo tour dự kiến ngay (bước sửa tay `date_pinned`). Chưa có tour thật thì chuỗi neo vào tour dự kiến sớm nhất (`start` của sync). `createCardTours`: DV đã có tour dự kiến → **dùng lại tour dự kiến sớm nhất** làm tour thật (không tạo trùng).

## Risks / Trade-offs

- [Nhiều nơi đếm tour] → gom về lọc `planned` ở các chỗ liệt kê trong mục 7; test `planRoadmap` + `journeyDue` có tour dự kiến.
- [Sinh lại chạy trong server action, không transaction] → 2 người thao tác cùng thẻ có thể sinh trùng; lần sync kế tiếp tự sửa (diff xoá phần thừa). Chấp nhận với quy mô hiện tại.
- ["Còn mực +1" với Laser (once)] → tăng buổi không tăng tiền; Sales tự thu thêm nếu bán thêm. Ghi chú trong UI.
- [Tour dự kiến quá ngày chưa chốt] → nằm lại ngày cũ (hiện Dự kiến trong bảng); CSKH chốt với ngày mới → chuỗi sau dời theo.
