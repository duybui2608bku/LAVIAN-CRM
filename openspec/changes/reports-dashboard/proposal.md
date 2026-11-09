## Why

Sếp cần 1 màn hình đọc nhanh hiệu quả từ quảng cáo đến doanh thu. Số liệu hiện nằm rải rác (`/marketing` chỉ có quảng cáo, pipeline ở `/customers`, bill ở `/tour`), không có so sánh kỳ trước hay chi tiết theo ngày.

## What Changes

- Menu mới **Báo cáo** (`/reports`, chỉ admin, nhóm Quản trị) với 8 chỉ số theo khoảng ngày (giờ VN/WIB, mặc định 7 ngày gần nhất):
  Chi tiêu, Tin nhắn, Chi tiêu / Tin nhắn, Data, Chi tiêu / Data, Đặt cọc, Đặt lịch, Doanh thu.
- Mỗi card so sánh với kỳ liền trước cùng độ dài (▲/▼ %; chỉ số chi phí thì giảm = tốt).
- Phễu chuyển đổi Tin nhắn → Data → Đặt cọc → Đặt lịch kèm tỷ lệ từng bước; ROAS (Doanh thu / Chi tiêu) khi cùng tiền tệ.
- Biểu đồ cột theo ngày (chọn chỉ số) + bảng chi tiết từng ngày có dòng tổng.
- Nút chọn nhanh: Hôm nay, Hôm qua, 7 ngày, 30 ngày, Tháng này, Tháng trước.

## Định nghĩa số liệu

- **Chi tiêu / Tin nhắn**: Facebook Ads insights theo ngày (`time_increment=1`), cộng 2 tài khoản ads (giống `/marketing`).
- **Data**: khách hàng (`customers`, chưa xoá) tạo trong ngày.
- **Đặt cọc**: trong số Data của ngày đó, giai đoạn ở `deposited` trở về sau (`deposited|booked|visited|returning`) — cùng định nghĩa pipeline `/customers`.
- **Đặt lịch**: trong số Data của ngày đó, có ≥ 1 lịch hẹn (`clinic_appointments`) hoặc giai đoạn `booked|visited|returning`.
- **Doanh thu**: tổng `tours.bill_amount` (chưa xoá) theo `tour_date` (Rupiah).

## Impact

- `lib/marketing.ts` (+ `fetchFbAdsDaily`), `lib/reports.ts` (mới, thuần + test), `app/(app)/reports/{page,actions}.ts(x)` (mới), `components/reports/reports-view.tsx` (mới), `components/layout/app-shell.tsx`, `proxy.ts`, `messages/{vi,en}.json` (namespace `reports`).
- Không đổi DB (đọc bảng có sẵn) → không có migration.
