## ADDED Requirements

### Requirement: API phễu khách hàng theo khoảng ngày
Hệ thống SHALL cung cấp `GET /api/customers/funnel?from&to` (`from`/`to` dạng `YYYY-MM-DD`, tùy chọn — thiếu thì mặc định **hôm nay giờ Việt Nam** `Asia/Ho_Chi_Minh`) trả về 4 chỉ số phễu:
- `messages`: số khách nhắn tin (SMAX statistics-v2).
- `leads`: số khách để lại SĐT (SMAX statistics-v2).
- `appointments`: số lịch hẹn có `scheduled_at` trong khoảng chọn, chưa xóa mềm.
- `visited`: số khách hàng stage `visited` có `created_at` trong khoảng chọn, chưa xóa mềm.

`from`/`to` không hợp lệ SHALL trả 400. Định nghĩa 4 chỉ số SHALL khớp section "Khách hàng" hiện có trên trang báo cáo.

#### Scenario: Đếm đúng 4 chỉ số
- **WHEN** trong khoảng chọn SMAX ghi nhận 86 khách nhắn tin / 6 khách để lại SĐT, DB có 2 lịch hẹn `scheduled_at` trong khoảng và 3 khách stage `visited` tạo trong khoảng
- **THEN** API trả `data.messages.count = 86`, `data.leads.count = 6`, `data.appointments.count = 2`, `data.visited.count = 3`

#### Scenario: Khoảng ngày không hợp lệ
- **WHEN** gọi `?from=2026-09-31&to=2026-09-01`
- **THEN** API trả 400 với `{ error: { code, message } }`

### Requirement: Tăng trưởng so cùng kỳ liền trước
Mỗi chỉ số SHALL kèm `previousCount` và `growthPercent` so với **kỳ liền trước cùng độ dài** của khoảng chọn — server tự lấy số kỳ trước, client không phải gọi 2 lần. Công thức growth: previous = 0 → 0% nếu current = 0, ngược lại 100%; khác 0 → `(current − previous) / |previous| × 100`.

#### Scenario: Growth tính ở server
- **WHEN** khoảng chọn có 6 khách nhắn tin và kỳ liền trước có 4
- **THEN** `data.messages = { count: 6, previousCount: 4, growthPercent: 50 }`

### Requirement: Lỗi cô lập theo nguồn
Lỗi một nguồn SHALL không làm hỏng nguồn còn lại: SMAX lỗi (kỳ nào cũng vậy) → `messages`/`leads` = null và `errors.smax` có message; DB lỗi → `appointments`/`visited` = null và `errors.db` có message; response vẫn HTTP 200 với các chỉ số nguồn lành mạnh đầy đủ.

#### Scenario: SMAX hỏng, DB vẫn trả số
- **WHEN** SMAX API lỗi mạng còn Supabase hoạt động bình thường
- **THEN** API trả 200 với `data.messages = null`, `data.leads = null`, `errors.smax` có message, `data.appointments`/`data.visited` vẫn có số + growth

### Requirement: Bảo vệ admin và metadata kỳ
API SHALL gác quyền admin (`requireAdmin`): chưa đăng nhập hoặc không phải admin trả 403 `{ error: { code: "FORBIDDEN", message } }`. Response thành công SHALL kèm `period { from, to, previous { from, to }, today, timezone }`.

#### Scenario: Không phải admin
- **WHEN** user thường (role `user`) gọi API
- **THEN** API trả 403 kèm `error.message`, không trả số liệu

#### Scenario: Response có period
- **WHEN** admin gọi `?from=2026-07-20&to=2026-07-24` vào ngày 2026-07-24 (giờ VN)
- **THEN** response chứa `period.from = "2026-07-20"`, `period.previous = { from: "2026-07-15", to: "2026-07-19" }`, `period.today = "2026-07-24"`, `period.timezone = "Asia/Ho_Chi_Minh"`
