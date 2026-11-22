## Why

Khách mua thẻ liệu trình đi theo lộ trình cố định nhưng hệ thống không biết khách đang ở bước nào và khi nào cần gọi lại:
- Thẻ có **Laser** (xoá mày/môi cũ): làm laser → **20 ngày** sau kiểm tra. OK → làm mới dịch vụ chính (mày/môi); chưa OK → laser tiếp, 20 ngày sau kiểm tra lại.
- **Làm mới** (thẳng, hoặc sau laser OK) → **45 ngày** sau **dặm**.

Tour hiện chỉ hiện "Lần n" (loại laser / làm mới / dặm bị ẩn, tự đoán theo tên dịch vụ) nên không nhìn ra tour là làm mới hay dặm, Sales phải tự nhớ ngày gọi khách. Số buổi của dịch vụ trong thẻ cũng không sửa được sau khi bán.

## What Changes

- **Loại tour hiện lại**: Laser / Làm mới / Dặm (kèm số: Laser 2, Dặm 1). Gợi ý tự động khi tạo tour từ thẻ (DV nhóm laser → Laser; DV khác chưa có tour Làm mới → Làm mới, đã có → Dặm), sửa được ở modal Tạo tour và drawer tour. Lưu vào cột sẵn có `tours.service_detail` + `service_session` — **không đổi DB**. Bảng tour, thẻ KTV, lộ trình trong thẻ, Excel, phiếu tour hiện theo Loại thay cho "Lần n".
- **Đến hạn liệu trình** (tab mới ở `/cards`): danh sách **tự tính** từ thẻ + tour, không lưu lịch nhắc, không bật lại tính năng Lịch nhắc đang tắt:
  - **Kiểm tra laser** = ngày tour laser gần nhất + 20 ngày, khi chưa có tour nào sau đó và thẻ còn buổi. Kết quả kiểm tra suy theo tour kế tiếp: tạo tour Laser tiếp = chưa OK; tạo tour Làm mới = OK.
  - **Dặm** = ngày tour Làm mới / Dặm gần nhất của dịch vụ + 45 ngày, khi dịch vụ đó còn buổi trong thẻ. Hết buổi = xong liệu trình, không nhắc.
  - Tạo tour mới (kể cả hẹn ngày tương lai) → mục đến hạn tự biến mất.
  - Lọc Quá hạn / Hôm nay / Sắp tới; người phụ trách = **Sales bán thẻ** (người tạo thẻ). Sales mặc định thấy khách của mình, admin thấy tất cả.
- **Sửa số buổi** dịch vụ trong thẻ (quyền `cards.edit`), không nhỏ hơn số tour đã có — để "hết buổi" phản ánh đúng thực tế (vd. laser OK sớm hơn dự kiến → giảm số buổi laser).
- Hằng số 20 / 45 ngày đặt 1 chỗ trong `lib/cards.ts`.

## Capabilities

### New Capabilities
- `treatment-journey`: Loại tour (Laser / Làm mới / Dặm), danh sách Đến hạn liệu trình, sửa số buổi dịch vụ trong thẻ.

### Modified Capabilities
<!-- Không có spec chính nào cho tour/thẻ trong openspec/specs (chỉ có money-audit). -->

## Impact

- Không có migration (cột + check constraint `tours_service_detail_check` đã có; RLS ghi `treatment_card_items` đã cho `cards.edit`).
- Sửa: `lib/cards{,.test}.ts` (gợi ý Loại, tính đến hạn, schema), `app/(app)/cards/actions.ts` (tạo tour nhận Loại, sửa số buổi), `components/cards/{cards-view,card-drawer}.tsx`, `components/tour/{tour-drawer,tour-view,tour-data,tour-slips}.tsx`, `messages/{vi,en}.json`.
- Mới: `components/cards/journey-due.tsx` (bảng Đến hạn).
- Không ảnh hưởng tiền (thẻ, báo cáo) hay quyền.
