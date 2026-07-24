## ADDED Requirements

### Requirement: API xu hướng 7 ngày gần nhất
Hệ thống SHALL cung cấp `GET /api/appointments/trend?to=YYYY-MM-DD` (`to` tùy chọn — thiếu thì mặc định **hôm nay giờ Việt Nam** `Asia/Ho_Chi_Minh`) trả về mảng đúng **7 phần tử**, tăng dần theo ngày, phủ khoảng `[to − 6 ngày, to]`. Mỗi phần tử `{ date, data, appointments, visited }` đếm theo **ngày VN**:
- `data`: khách hàng có `customers.created_at` trong ngày, chưa xóa mềm.
- `appointments`: lịch hẹn có `scheduled_at` trong ngày, chưa xóa mềm.
- `visited`: lịch hẹn có `checked_in_at` trong ngày, chưa xóa mềm.

Ngày không có số liệu SHALL vẫn xuất hiện trong mảng với giá trị `0`. `to` không hợp lệ (sai định dạng hoặc ngày không tồn tại) SHALL trả 400. API SHALL gác **đăng nhập** (không cần admin — chỉ là số đếm, không có số tiền, và RLS đã cho mọi user đăng nhập đọc `customers`/`appointments`); chưa đăng nhập SHALL trả 401.

#### Scenario: Mặc định hôm nay
- **WHEN** gọi API không kèm `to` và hôm nay (VN) là 2026-07-24
- **THEN** `data` có 7 phần tử với `date` từ `2026-07-18` đến `2026-07-24`, và `period = { from: "2026-07-18", to: "2026-07-24", days: 7 }`

#### Scenario: Đếm đúng theo ngày VN
- **WHEN** một lịch hẹn có `scheduled_at = 2026-07-19T16:00:00Z` (tức 23:00 ngày 19/07 giờ VN) và một lịch khác `scheduled_at = 2026-07-19T17:30:00Z` (00:30 ngày 20/07 giờ VN)
- **THEN** lịch đầu được đếm vào `date = "2026-07-19"`, lịch sau vào `date = "2026-07-20"`

#### Scenario: Khách đến tính theo giờ check-in
- **WHEN** một lịch hẹn có `scheduled_at` ngày 20/07 nhưng `checked_in_at` ngày 21/07 (giờ VN)
- **THEN** lịch đó cộng vào `appointments` của ngày 20/07 và vào `visited` của ngày 21/07

#### Scenario: Ngày trống vẫn có mặt
- **WHEN** trong 7 ngày có 1 ngày không phát sinh khách, lịch hẹn hay check-in nào
- **THEN** ngày đó vẫn nằm trong mảng với `{ data: 0, appointments: 0, visited: 0 }`

#### Scenario: Bản ghi xóa mềm không tính
- **WHEN** khách hàng hoặc lịch hẹn trong khoảng có `deleted_at` khác null
- **THEN** bản ghi đó không được đếm vào bất kỳ chỉ số nào

#### Scenario: Tham số không hợp lệ
- **WHEN** gọi `?to=2026-02-31`
- **THEN** API trả 400 với `{ error: { code, message } }`

#### Scenario: Chưa đăng nhập
- **WHEN** gọi API không kèm session hợp lệ
- **THEN** API trả 401 với `{ error: { code, message } }`
