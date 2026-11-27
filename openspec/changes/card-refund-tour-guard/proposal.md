## Why

Phân tích đa vai trò ngày 27/11/2026 (`docs/analysis/2026-11-27-phan-tich-da-vai-tro.md`) còn 3 bug người dùng yêu cầu sửa:

- **B3:** Hoàn thẻ chỉ xoá tour dự kiến. Tour thật đang "Chờ nhận" vẫn còn, Master vẫn nhận được và được tính công trên thẻ đã hoàn tiền.
- **B6:** Ghim ngày bước dự kiến k sang sau bước k+1 thì thứ tự bước đảo, cờ ghim nhảy sang bước khác. Cũng ghim được vào quá khứ.
- **B8:** Lead-form báo mọi lỗi trùng (23505) là "trùng lịch hẹn", kể cả trùng SĐT hay trùng hội thoại SMAX.

## What Changes

- **Hoàn thẻ** (RPC `refund_treatment_card`): xoá mềm thêm các tour thật chưa có Master nhận. Tour đã có Master giữ nguyên.
- **Guard DB** `tours_card_guard`: nhận / gán Master cho tour thuộc thẻ đã huỷ / hoàn, hoặc dòng DV đã hoàn → `card_cancelled`. Server `claimTour` đổi lỗi này thành câu dễ hiểu.
- **Ghim ngày** (`setPlannedTourDate` + `plannedDateError` ở `lib/tours.ts`): ngày phải từ hôm nay trở đi, sau tour thật và bước dự kiến trước, và trước bước dự kiến đã ghim kế sau (cùng dòng thẻ).
- **Lead-form:** lỗi 23505 báo theo tên unique index: trùng lịch hẹn, trùng SĐT, trùng hội thoại SMAX, hoặc câu chung.

## Impact

- `supabase/migrations/20261127140000_refund_card_unclaimed_tours.sql`
- `app/(app)/tour/actions.ts`, `app/(app)/cards/actions.ts`, `app/lead-form/actions.ts`, `lib/tours.ts` (+ test)
- `messages/{vi,en}.json`
