## Why

Trang Marketing mới có số tin nhắn FB theo chiến dịch, chưa biết chiến dịch nào ra khách chất lượng (để lại số / đặt lịch / mua).

## What Changes

- Bảng chiến dịch `/marketing` thêm cột **KH tiềm năng**.
- Khách tiềm năng = hội thoại SMAX (WA + IG) **tạo trong khoảng ngày** có ≥1 tag `phone` (Phone/WA), `booking`, `bookings-deposit`, `purchase`. Mỗi hội thoại tính tối đa 1 lần dù gắn nhiều tag.
- Chiến dịch IG: ghép `instagram.ad_id` của hội thoại (fallback `customer.instagram.ad_id`) với `ad_id → campaign_id` lấy từ FB insights `level=ad` cùng khoảng ngày.
- Chiến dịch WA: theo số WA trong tên chiến dịch (cột WA, `WA<4 số>`) ↔ `page_pid` hội thoại (`waw…<4 số>`). Nhiều chiến dịch dùng chung 1 số → mỗi dòng hiện tổng của số đó, có tooltip cảnh báo.
- Lỗi SMAX/FB → cột hiện "—" kèm tooltip lỗi.

## Impact

- `lib/smax-inbox.ts` (`POTENTIAL_ALIASES`, `countPotential` + test), `lib/marketing.ts` (`fetchFbAdCampaigns`), `app/(app)/marketing/actions.ts` (`potential`), `components/marketing/ads-stats.tsx`, `messages/{vi,en}.json`.
- Không đổi DB.
