## Why

Trang `/marketing` đang dùng chung component báo cáo cũ (phễu, tag, nhân viên…) — quá nhiều thứ không phục vụ việc đọc hiệu quả quảng cáo. Cần trang gọn chỉ gồm 7 chỉ số quảng cáo, lấy dữ liệu từ 2 tài khoản ads `1494701561142295` và `405282048979489`.

## What Changes

- Bỏ toàn bộ UI cũ của `/marketing`; thay bằng 7 stat card theo khoảng ngày (giờ VN): Chi tiêu, Tin nhắn, Chi tiêu/Tin nhắn, Data, Chi tiêu/SĐT, Lịch hẹn, Đã đến.
- Đổi tài khoản ads thứ 2 `act_3723515967967924` → `act_405282048979489`.
- `fetchFbSpend` → `fetchFbAds` lấy cả `spend` và tin nhắn (`onsite_conversion.messaging_conversation_started_7d`) trong 1 request/tài khoản.
- Data = SMAX "Khách hàng để lại SĐT" (`customer_lead_total`).
- Lịch hẹn = đếm `appointments.scheduled_at` trong range; Đã đến = đếm `appointments.checked_in_at` trong range.
- Gỡ phần chi tiêu (`showSpend`, `includeSpend`) khỏi `MarketingStats`/`getMarketingStats` vì không còn ai dùng.

## Impact

- `lib/marketing.ts`, `app/(app)/marketing/{page,actions}.ts(x)`, `components/marketing/ads-stats.tsx` (mới), `components/dashboard/marketing-stats.tsx`, `app/(app)/actions.ts`, `messages/*.json` (namespace `marketing`).
- Không đổi DB.
