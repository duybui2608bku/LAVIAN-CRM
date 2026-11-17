## Why

Báo cáo Smax và Follow up là 2 menu riêng nhưng dùng chung dữ liệu hội thoại SMAX → gộp 1 trang, thẻ số theo bộ chỉ số mới.

## What Changes

- Bỏ menu/trang `/customers/smax-followup`; `/customers/smax-report` hiện cả bảng Follow up theo Telesales (cuối trang).
- 1 server action `getSmaxReport` (thay `getInboxReport` + `getFollowupReport`): 2 lượt tải hội thoại (`byCreated` + tin nhắn từ đầu kỳ tới hôm nay) dùng chung cho cả 2 báo cáo — bỏ lượt tải lọc tag booking (tập "active" đã chứa nó).
- Thẻ số: **Re-engaged** (khách cũ nhắn / gắn Booking / gắn Purchase trong kỳ — cùng định nghĩa "Số bào"), **Khách mới**, **Tổng Booking** (gắn tag booking trong kỳ), **Booking mới** (= Tổng − Booking khách cũ, ghi chú "Booking cũ: n"), **Khách đến** (gắn tag `purchase` trong kỳ, mọi khách). Bỏ thẻ Potential / Follow Up / Pending 24H / Spam (bảng vẫn giữ cột).
- Bảng Theo Telesales: cột Old Booking → **New Booking**.
- "Theo kênh" chia 7/3 với donut **Booking theo nguồn** (WA/IG).

## Impact

`lib/smax-inbox.ts` (`InboxCounts.reEngaged/showUp`), test, `app/(app)/customers/smax-report/actions.ts`, `components/customers/smax-report-view.tsx` (gộp view Follow up), `components/layout/app-shell.tsx`, `messages/{vi,en}.json`. Không đổi DB.
