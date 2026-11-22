## Context

- `tours.service_detail` ∈ laser | plasma | new | debt | retouch, `service_session` 1–20 (bắt buộc với laser/plasma/retouch, null với new/debt) — check constraint DB đã có. Từ 2026-11-22 UI chỉ hiện "Lần n", Loại do `tourDetailFor(service, n)` đoán (nhóm laser / tên "laser" → Laser n; "plasma" → Plasma n; còn lại lần 1 = New, n ≥ 2 = Retouch n−1).
- Tour chỉ tạo từ thẻ (`createCardTours`, mỗi dịch vụ chọn = 1 tour, gắn `card_item_id`). `/cards` đã tải toàn bộ thẻ + tour gắn thẻ (`loadCards`), đủ dữ liệu để tính đến hạn ở client.
- Lịch nhắc (`customer_reminders`) có sẵn nhưng đang tắt (`REMINDERS_ENABLED = false`) và gắn Telesales — không hợp với "Sales bán thẻ phụ trách".
- Sếp chốt (2026-11-22): kết quả kiểm tra laser suy theo tour kế tiếp; dặm tiếp theo số buổi thẻ; danh sách tự tính; Sales bán thẻ phụ trách; cần sửa được số buổi.

## Goals / Non-Goals

**Goals:** nhìn ra tour là Laser / Làm mới / Dặm; biết khách nào đến hạn kiểm tra laser / dặm, quá hạn bao lâu, ai gọi; không thêm bảng, không cron.

**Non-Goals:** gửi tin tự động cho khách; thông báo chuông; lưu "đã gọi khách" (gọi xong thì tạo tour/lịch hẹn → mục tự hết); nhắc khách chưa làm buổi nào sau khi mua thẻ; bật lại Lịch nhắc.

## Decisions

1. **Không thêm cột Loại** — dùng lại `service_detail` + `service_session`. Loại chọn được (`TOUR_KINDS`): Laser / Plasma (xoá môi, như laser) / Làm mới / Dặm; hiển thị "Laser n", "Plasma n", "Làm mới", "Dặm n"; dữ liệu cũ `debt` → "Debt" (chỉ hiển thị).
   - Thay `tourDetailFor(service, n)` bằng `suggestTourKind(service, itemTours)` (nhóm laser / tên "laser" → Laser; tên "plasma" → Plasma; DV khác chưa có tour `new` → Làm mới, đã có → Dặm) + `tourKindDetail(kind, date, others)` (số = tour cùng loại khác của dòng có ngày ≤ ngày tour + 1). Số lần luôn do server tính (không nhập tay) — đổi Loại là số đổi theo.
   - Alternative: thêm cột `tour_kind` riêng — thừa, trùng nghĩa với `service_detail`.
2. **Đến hạn tự tính, hàm thuần `journeyDue(cards, tours, today)`** trong `lib/cards.ts` (có test), chạy ở client trang `/cards`. Không lưu → không lệch dữ liệu khi sửa/xoá tour.
   - Mỗi thẻ chưa huỷ, tour gắn thẻ chưa xoá, sắp theo `tour_date`:
     - **Kiểm tra laser**: tour cuối cùng của cả thẻ là Laser (hoặc Plasma cũ) **và** thẻ còn ≥ 1 dòng chưa hoàn có `used < sessions` → hạn = ngày tour đó + `LASER_CHECK_DAYS` (20).
     - **Dặm**: mỗi dòng DV chưa hoàn, không phải laser, có tour cuối là Làm mới / Dặm **và** `used < sessions` → hạn = ngày tour đó + `RETOUCH_DAYS` (45). Bỏ qua dòng mà tour cuối của cả thẻ là laser (đang chờ kiểm tra).
   - Tour ngày tương lai cũng tính là "tour kế tiếp" → đã hẹn rồi thì không nhắc nữa.
   - Trạng thái: quá hạn (hạn < hôm nay), hôm nay, sắp tới (≤ 7 ngày), còn lại ẩn khỏi tab mặc định nhưng có ở "Tất cả".
3. **UI tab trong `/cards`** (Segmented "Thẻ liệu trình | Đến hạn (N)") thay vì menu mới — dữ liệu đã có sẵn, quyền dùng `cards.view`. Cột: Hạn (tag Quá hạn N ngày / Hôm nay / Còn N ngày), Khách (bấm → 360°), Thẻ (mã, bấm → CardDrawer), Việc (Kiểm tra laser / Dặm n · tên DV), Tour gần nhất, Sales (người tạo thẻ). Lọc Sales: mặc định là chính mình nếu không phải admin.
4. **Sửa số buổi**: nút sửa cạnh "x/y buổi" ở drawer thẻ (InputNumber trong Popover), action `updateCardItemSessions(itemId, sessions)`: `cards.edit`, 1–100, ≥ số tour chưa xoá của dòng, dòng chưa hoàn, thẻ chưa huỷ.
5. **Tạo tour từ thẻ**: mỗi dòng DV chọn Loại (Select Laser / Làm mới / Dặm, gợi ý sẵn) + hiển thị số tự tính; `cardTourSchema.items[]` đổi `session` → `kind` (`laser | new | retouch`), server tự tính `service_session` từ tour hiện có của dòng (không tin số client gửi).
6. **Drawer tour**: ô "Lần" → ô Loại (Laser / Làm mới / Dặm); đổi Loại → server tính lại số theo các tour khác cùng dòng thẻ (tour cũ không thẻ: số = 1).

## Risks / Trade-offs

- [Tour cũ Debt / Plasma] → vẫn hiển thị đúng; Plasma tính như laser cho kiểm tra 20 ngày (môi dùng plasma thay laser). Nếu sếp không muốn → bỏ `plasma` khỏi điều kiện (1 dòng).
- [Thẻ chỉ có laser, kiểm tra OK nhưng còn buổi] → mục kiểm tra không tự hết; Sales giảm số buổi laser = số đã làm → hết. Ghi rõ trong hướng dẫn.
- [Tải toàn bộ thẻ ở client] → đã chấp nhận ở `loadCards` (vài trăm thẻ); nhiều nghìn thẻ thì tính ở server.
- [Số lần tự tính khi đổi Loại tour cũ] → có thể trùng số với tour khác cùng loại nếu tour bị xoá/sửa ngày; chỉ ảnh hưởng nhãn, không ảnh hưởng tiền.

## Open Questions

- Plasma (xoá môi) có theo quy tắc kiểm tra 20 ngày như laser không? Mặc định: **có**.
