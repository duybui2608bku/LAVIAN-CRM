## Why

Section "Khách hàng" trên trang báo cáo (phễu: Khách nhắn tin → Để lại SĐT → Lịch hẹn → Đã đến) hiện lấy số từ server action `getMarketingStats` — client phải gọi 2 lần (kỳ hiện tại + kỳ trước) rồi tự chia growth, response gộp cả staff/tags/reply-time thừa thãi. Cần API độc lập trả đúng 4 chỉ số phễu kèm tăng trưởng, cùng pattern với `/api/appointments/summary` và `/api/finance/revenue`.

## What Changes

- Thêm route handler `GET /api/customers/funnel?from&to` (`from`/`to` tùy chọn `YYYY-MM-DD`, mặc định **hôm nay giờ VN**; sai → 400):
  1. **`messages` (Khách nhắn tin)** — từ SMAX statistics-v2 (`fetchSmaxStats`).
  2. **`leads` (Khách hàng để lại SĐT)** — cùng nguồn SMAX.
  3. **`appointments` (Lịch hẹn)** — đếm `appointments.scheduled_at` trong khoảng chọn, chưa xóa mềm (khớp card hiện tại).
  4. **`visited` (Đã đến)** — đếm `customers` stage `visited` có `created_at` trong khoảng chọn, chưa xóa mềm (khớp card hiện tại).
- Mỗi chỉ số `{ count, previousCount, growthPercent }` so **kỳ liền trước cùng độ dài** (server tự query kỳ trước — client hết phải gọi 2 lần).
- **Lỗi cô lập theo nguồn** như dashboard: SMAX lỗi → `messages`/`leads` = null + `errors.smax`; DB lỗi → `appointments`/`visited` = null + `errors.db`; nguồn còn lại vẫn trả số.
- Gác **admin** (`requireAdmin` — khớp `getMarketingStats` hiện tại vì có số SMAX; chưa đăng nhập/không phải admin → 403).
- KHÔNG đổi DB, KHÔNG đổi UI (gắn card dùng API là việc sau), `getMarketingStats` giữ nguyên.

## Capabilities

### New Capabilities
- `customer-funnel-api`: API phễu khách hàng theo khoảng ngày (nhắn tin / để lại SĐT / lịch hẹn / đã đến) kèm tăng trưởng cùng kỳ, lỗi cô lập theo nguồn.

### Modified Capabilities

(không có)

## Impact

- Thêm mới: `app/api/customers/funnel/route.ts`.
- Tái dùng: `fetchSmaxStats`/`supaRange` (lib/marketing), `getGrowthRate`/`getPreviousFinancialRange`/`isValidDateRange` (lib/financial), `requireAdmin` (lib/auth), `normalizeError` (lib/errors).
- Không migration, không i18n, không đổi component.
