# Tasks: dashboard-marketing-stats

## 1. Lib đổi ngày + fetch nguồn
- [x] 1.1 `lib/marketing.ts`: `addDays(ymd, n)` (Date.UTC thuần số học), `smaxRange(from, to)`, `supaRange(from, to)` — helper thuần, export để test
- [x] 1.2 `fetchFbSpend(from, to)`: Promise.all 2 account, `v25.0/act_{id}/insights?fields=spend&time_range=...`, cộng spend; ném lỗi nếu 1 account fail
- [x] 1.3 `fetchSmaxStats(from, to)`: POST statistics-v2, Bearer SMAX_TOKEN, trả `{messages, leads}`
- [x] 1.4 Test `lib/marketing.test.ts` cho helper ngày (range 1 ngày, nhiều ngày, qua tháng)

## 2. Server action
- [x] 2.1 `app/(app)/actions.ts`: `getMarketingStats(from, to)` — validate `YYYY-MM-DD`, check đăng nhập, Promise.allSettled 3 nguồn (FB / SMAX / Supabase counts), trả số + `errors` per nguồn

## 3. UI dashboard
- [x] 3.1 `components/dashboard/marketing-stats.tsx` (client): DateRangePicker (mặc định hôm nay) + grid 6 stat cards, useTransition, card lỗi hiện "—" + message
- [x] 3.2 Viết lại `app/(app)/page.tsx`: bỏ pivot, render tiêu đề + `<MarketingStats />`
- [x] 3.3 i18n namespace `dashboard` ×3 locale (title, tên 6 card, lỗi nguồn, đơn vị)

## 4. Kiểm chứng
- [x] 4.1 `node --test lib/marketing.test.ts` + test cũ pass
- [x] 4.2 `tsc --noEmit` + eslint file sửa + JSON 3 locale parse
- [x] 4.3 `next build` pass
- [x] 4.4 Smoke test FB + SMAX bằng token thật (script tạm, không commit)
