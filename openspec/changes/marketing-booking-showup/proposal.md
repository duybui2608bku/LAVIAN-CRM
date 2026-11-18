## Why

Bảng chiến dịch `/marketing` mới có cột KH tiềm năng — chưa biết chiến dịch nào thực sự ra Booking và khách đến (Show up).

## What Changes

- Bảng chiến dịch thêm 2 cột **Booking** và **Show up**, đứng sau cột KH tiềm năng (cả bảng desktop và danh sách mobile).
- Cùng tập người với KH tiềm năng (khách SMAX WA + IG **xuất hiện lần đầu trong kỳ**, gộp IG ↔ WA theo SĐT, mỗi người tính 1 lần), cùng cách gán chiến dịch (IG theo `ad_id`, WA theo số WA trong tên chiến dịch):
  - **Booking** = người có tag `booking` hoặc `bookings-deposit`.
  - **Show up** = người có tag `purchase`.
  - Cả 2 đều là tập con của KH tiềm năng → đọc như phễu Tiềm năng → Booking → Show up.
- Tag xét theo trạng thái hiện tại của hội thoại (như KH tiềm năng), không lọc theo thời điểm gắn tag.
- Tooltip "nhiều chiến dịch chung 1 số WA" và "—" khi lỗi áp dụng cho cả 3 cột.

## Impact

- `lib/smax-inbox.ts`: `countPotential` trả `{ potential, booking, showUp }` cho mỗi chiến dịch / số WA / tổng (+ test).
- `components/marketing/ads-stats.tsx`, `messages/{vi,en}.json`.
- Không đổi DB, không thêm lượt gọi API.
