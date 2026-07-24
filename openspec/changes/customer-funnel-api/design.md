## Context

4 card phễu "Khách hàng" trên `/` lấy số từ `getMarketingStats` (admin, allSettled, lỗi cô lập per nguồn) — client gọi 2 lần để tự tính growth. Đã có 2 API thống kê cùng pattern: `/api/finance/revenue` (requireAdmin, from/to, growth server-side) và `/api/appointments/summary` (login, from/to mặc định hôm nay VN). API phễu này ghép 2 pattern đó.

## Goals / Non-Goals

**Goals:**
- 1 route `GET /api/customers/funnel?from&to`, mặc định hôm nay VN, growth server-side, lỗi cô lập theo nguồn (SMAX / DB).
- Định nghĩa 4 chỉ số **khớp y nguyên** card hiện tại (đổi nguồn số liệu mà không đổi con số).

**Non-Goals:**
- KHÔNG gắn UI (marketing-stats.tsx giữ nguyên — chuyển card sang API này làm sau khi user yêu cầu).
- KHÔNG gộp spend/costPerMessage (thuộc FB Ads, ngoài phễu khách hàng).
- KHÔNG cache/không RPC.

## Decisions

1. **Tham số + ngày neo**: `from`/`to` tùy chọn, mặc định hôm nay `Asia/Ho_Chi_Minh` (Intl "en-CA"), validate `isValidDateRange` → 400 — copy `/api/appointments/summary`. Kỳ trước qua `getPreviousFinancialRange`.
2. **Nguồn số**: `messages`/`leads` = `fetchSmaxStats(from, to)` (SMAX tự quy đổi range VN qua `smaxPayload`); `appointments` = count `scheduled_at ∈ supaRange`, `deleted_at is null`; `visited` = count `customers` `stage='visited'`, `created_at ∈ supaRange`, `deleted_at is null` — cả 4 khớp `getMarketingStats` để số không lệch giữa 2 nguồn.
3. **Growth server-side**: gọi nguồn 2 lần (kỳ chọn + kỳ trước) trong 1 `Promise.allSettled` 6 promise (SMAX ×2, appointments ×2, visited ×2); `getGrowthRate` như các API kia.
4. **Lỗi cô lập theo NGUỒN, không theo chỉ số**: SMAX hỏng (1 trong 2 kỳ) → `messages`/`leads` null + `errors.smax`; DB hỏng → `appointments`/`visited` null + `errors.db`. Cả 2 hỏng vẫn 200 với data toàn null — client tự hiện lỗi per card (khớp hành vi dashboard hiện tại). Chỉ 403/400/500 khi auth/validate/lỗi ngoài dự kiến.
5. **Gác `requireAdmin`** (403 AppError FORBIDDEN): số SMAX hiện chỉ admin xem được qua `getMarketingStats` — giữ nguyên ranh giới; hạ xuống login-only khi user quyết định mở.
6. **Shape**: `{ data: { messages, leads, appointments, visited }, errors: { smax?, db? }, period: { from, to, previous, today, timezone } }` — mỗi chỉ số `{ count, previousCount, growthPercent } | null`.

## Risks / Trade-offs

- [SMAX flake mạng (đã ghi nhận ở memory bank) → 2 lần gọi tăng xác suất hỏng cả cặp] → lỗi cô lập: DB vẫn trả số; client đổi range là retry.
- [Đếm appointments/visited bằng count head → khác `getMarketingStats` (kéo row để breakdown deposited)] → count-only đủ cho 4 card phễu; breakdown deposited vẫn ở action cũ.
- [Hai nguồn "Lịch hẹn"/"Đã đến" tồn tại song song (action + API)] → định nghĩa query giữ giống hệt; khi UI chuyển hẳn sang API thì cân nhắc bỏ phần trùng trong action.
