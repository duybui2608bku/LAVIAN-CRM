# Tasks: fix-ig-booking-old-ads

## 1. Tra ad_id cũ

- [x] 1.1 `unmatchedIgAdIds(threads, ads, igByPhone)` trong `lib/smax-inbox.ts` (thuần, chỉ người có tag tiềm năng) + test
- [x] 1.2 `fetchFbAdCampaignsByIds(ids)` trong `lib/marketing.ts`: `GET /{ad_id}?fields=campaign_id`, song song 10, cache tiến trình, lỗi → log
- [x] 1.3 `fetchPotential`: ghép ad_id chưa khớp vào map trước `countPotential`

## 2. Kiểm chứng

- [x] 2.1 `node --test lib/smax-inbox.test.ts` (12/12) + `tsc --noEmit` (0 lỗi ngoài `.next/types` cũ)
- [ ] 2.2 Gọi thử Graph API thật với 1 ad_id cũ — chặn: `FB_TOKEN` trong `.env.local` hết hạn 21/11/2026
