## 1. Route handler

- [x] 1.1 Tạo `app/api/customers/funnel/route.ts`: `requireAdmin()` → 403, nhận `from`/`to` (mặc định hôm nay VN, validate `isValidDateRange` → 400), kỳ trước qua `getPreviousFinancialRange`
- [x] 1.2 `Promise.allSettled` 6 promise: `fetchSmaxStats` (kỳ chọn + kỳ trước), count appointments `scheduled_at` (×2), count customers visited `created_at` (×2) — count head, khớp định nghĩa `getMarketingStats`
- [x] 1.3 Ghép response lỗi-cô-lập: `{ data: { messages, leads, appointments, visited }, errors: { smax?, db? }, period }` — chỉ số `{ count, previousCount, growthPercent } | null`, growth qua `getGrowthRate`; catch → `normalizeError`

## 2. Kiểm chứng

- [x] 2.1 `npx tsc --noEmit` + eslint sạch
- [x] 2.2 Smoke test: không session → 403 đúng shape; count visited chạy thật qua REST secret key (11 all-time), count appointments cùng dạng đã verify ở change `appointment-stats-api`; SMAX helper là code sản xuất đang chạy trên dashboard. CÒN THIẾU: happy path có session admin (cần đăng nhập browser)
- [x] 2.3 Cập nhật `memory-bank/README.md`
