## Why

Trang báo cáo cần bộ chỉ số lịch hẹn "cố định theo hôm nay" (không đổi theo bộ lọc ngày) kèm tăng trưởng so cùng kỳ — hiện các số này nằm rải trong `getMarketingStats` (gộp chung SMAX/FB, gác admin, không có tăng trưởng và không đếm được "lịch hẹn phát sinh từ khách mới trong ngày"). Cần một API độc lập, gọn, trả đúng 3 chỉ số + growth.

## What Changes

- Thêm route handler `GET /api/appointments/summary?from&to` (`from`/`to` tùy chọn `YYYY-MM-DD`, mặc định **hôm nay giờ VN** — 2 chỉ số đầu đổi theo bộ lọc ngày của UI, chỉ số 3 luôn cố định):
  1. **`selected` (Lịch hẹn hôm nay / Lịch hẹn {ngày chọn})** — đếm lịch có `scheduled_at` trong khoảng chọn, chưa xóa mềm. UI tự đổi label khi khoảng chọn không phải hôm nay (so `period.from/to` với `period.today`).
  2. **`newCustomer` (Lịch hẹn trong ngày — khách mới)** — đếm lịch **tạo trong khoảng chọn** (`appointments.created_at`) của **khách hàng tạo trong khoảng chọn** (`customers.created_at`).
  3. **`tomorrow` (Lịch hẹn ngày mai)** — đếm lịch có `scheduled_at` rơi vào **ngày mai giờ VN**, KHÔNG đổi theo bộ lọc.
- Mỗi chỉ số kèm `previousCount` + `growthPercent` so **cùng kỳ liền trước cùng độ dài**: `selected`/`newCustomer` so kỳ liền trước của khoảng chọn; `tomorrow` so hôm nay (VN).
- Gác **đăng nhập** (không cần admin — dữ liệu lịch hẹn mọi user đọc được sẵn qua RLS); chưa đăng nhập trả 401.
- Tái dùng helper sẵn có: `supaRange`/`addDays` (`lib/marketing`), `getGrowthRate` (`lib/financial`). KHÔNG thêm bảng/cột/migration, KHÔNG đổi UI.

## Capabilities

### New Capabilities
- `appointment-stats-api`: API thống kê nhanh lịch hẹn theo ngày hôm nay giờ VN (hôm nay / phát sinh từ khách mới / ngày mai) kèm tăng trưởng cùng kỳ.

### Modified Capabilities

(không có — không đổi requirement của capability hiện hữu)

## Impact

- Thêm mới: `app/api/appointments/summary/route.ts`.
- Không đổi DB, không đổi UI, không đổi i18n. `getMarketingStats` giữ nguyên (dashboard hiện tại không đụng).
- Proxy hiện chặn mọi route ngoài `PUBLIC_PATHS` khi chưa đăng nhập — route mới tự động được bảo vệ, trong handler vẫn check user để trả 401 rõ ràng.
