## ADDED Requirements

### Requirement: API thống kê lịch hẹn theo khoảng ngày chọn
Hệ thống SHALL cung cấp `GET /api/appointments/summary?from&to` (`from`/`to` dạng `YYYY-MM-DD`, tùy chọn — thiếu thì mặc định **hôm nay giờ Việt Nam** `Asia/Ho_Chi_Minh`) trả về 3 chỉ số đếm lịch hẹn chưa xóa mềm:
- `selected`: lịch có `scheduled_at` trong khoảng chọn — đổi theo bộ lọc ngày của UI.
- `newCustomer`: lịch được tạo trong khoảng chọn (`appointments.created_at`) của khách hàng được tạo trong khoảng chọn (`customers.created_at`, khách chưa xóa mềm) — đổi theo bộ lọc.
- `tomorrow`: lịch có `scheduled_at` thuộc **ngày mai giờ VN** — CỐ ĐỊNH, không phụ thuộc `from`/`to`.

`from`/`to` không hợp lệ (sai định dạng, ngày không tồn tại, `from` sau `to`) SHALL trả 400.

#### Scenario: Mặc định hôm nay
- **WHEN** gọi API không kèm `from`/`to` và hôm nay (VN) có 5 lịch `scheduled_at` hôm nay, 2 lịch tạo hôm nay bởi khách tạo hôm nay, 3 lịch `scheduled_at` ngày mai
- **THEN** API trả `data.selected.count = 5`, `data.newCustomer.count = 2`, `data.tomorrow.count = 3`

#### Scenario: Chọn ngày khác hôm nay
- **WHEN** gọi `?from=2026-09-25&to=2026-09-25` (hôm nay là 2026-07-24)
- **THEN** `selected`/`newCustomer` đếm theo ngày 2026-09-25, còn `tomorrow` vẫn đếm lịch của 2026-07-25 (ngày mai VN)

#### Scenario: Lịch xóa mềm không tính
- **WHEN** một lịch hẹn trong khoảng chọn có `deleted_at` khác null
- **THEN** lịch đó không được đếm vào bất kỳ chỉ số nào

#### Scenario: Lịch của khách cũ không tính vào newCustomer
- **WHEN** một lịch hẹn được tạo trong khoảng chọn nhưng khách hàng của lịch được tạo trước khoảng chọn
- **THEN** lịch đó không được đếm vào `newCustomer` (vẫn đếm vào `selected`/`tomorrow` nếu khớp `scheduled_at`)

#### Scenario: Khoảng ngày không hợp lệ
- **WHEN** gọi `?from=2026-09-31&to=2026-09-01`
- **THEN** API trả 400 với `{ error: { code, message } }`

### Requirement: Tăng trưởng so cùng kỳ liền trước
Mỗi chỉ số SHALL kèm `previousCount` và `growthPercent`: `selected` và `newCustomer` so với **kỳ liền trước cùng độ dài** của khoảng chọn; `tomorrow` so với **hôm nay giờ VN**. Công thức growth: previous = 0 → 0% nếu current = 0, ngược lại 100%; khác 0 → `(current − previous) / |previous| × 100`.

#### Scenario: Tính growth theo khoảng chọn
- **WHEN** khoảng chọn 2 ngày có 6 lịch và 2 ngày liền trước có 4 lịch
- **THEN** `data.selected = { count: 6, previousCount: 4, growthPercent: 50 }`

#### Scenario: Kỳ trước bằng 0
- **WHEN** kỳ liền trước có 0 lịch và kỳ chọn có 3 lịch
- **THEN** `data.selected.growthPercent = 100`

### Requirement: Bảo vệ đăng nhập và metadata cho label UI
API SHALL yêu cầu người dùng đã đăng nhập (mọi role); chưa đăng nhập trả HTTP 401 với `{ error: { code, message } }`. Lỗi khác trả cùng shape qua `normalizeError`. Response thành công SHALL kèm `period` gồm `from`, `to`, `previous { from, to }`, `today` (hôm nay VN), `tomorrow` (ngày mai VN), `timezone` — đủ để UI tự quyết label ("Lịch hẹn hôm nay" khi khoảng chọn là hôm nay, ngược lại "Lịch hẹn 25/9" theo ngày chọn).

#### Scenario: Chưa đăng nhập
- **WHEN** request không có session đăng nhập hợp lệ
- **THEN** API trả 401 kèm `error.message`, không trả số liệu

#### Scenario: Response thành công có period đủ cho label
- **WHEN** user đã đăng nhập gọi `?from=2026-09-25&to=2026-09-25` vào ngày 2026-07-24 (giờ VN)
- **THEN** response chứa `period.from = "2026-09-25"`, `period.today = "2026-07-24"`, `period.tomorrow = "2026-07-25"`, `period.previous.from = "2026-09-24"`, `period.timezone = "Asia/Ho_Chi_Minh"`
