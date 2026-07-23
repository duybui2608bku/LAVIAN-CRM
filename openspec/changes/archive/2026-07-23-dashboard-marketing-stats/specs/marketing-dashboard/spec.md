# Spec: marketing-dashboard

## ADDED Requirements

### Requirement: Dashboard thống kê marketing theo khoảng ngày
Trang chủ `/` SHALL hiển thị 6 stat cards theo một khoảng ngày chọn được (DateRangePicker, mặc định hôm nay giờ VN): Chi tiêu (FB Ads 2 tài khoản), Khách nhắn tin, Chi tiêu/tin nhắn, Để lại số, Lịch hẹn, Đã đến. Bảng pivot doanh thu theo dịch vụ cũ SHALL bị gỡ bỏ.

#### Scenario: Mở trang chủ
- **WHEN** user đã đăng nhập mở `/`
- **THEN** 6 stat cards hiển thị số liệu của hôm nay (giờ VN), có trạng thái loading trong lúc fetch

#### Scenario: Đổi khoảng ngày
- **WHEN** user chọn range khác trong DateRangePicker
- **THEN** cả 6 card cập nhật theo range mới

### Requirement: Nguồn số liệu và cách tính
Hệ thống SHALL lấy: Chi tiêu = tổng `spend` từ Graph API insights của `act_1494701561142295` + `act_3723515967967924`; Khách nhắn tin = `customer_message_total` và Để lại số = `customer_lead_total` từ SMAX statistics-v2; Lịch hẹn = số `appointments` có `scheduled_at` trong range (không tính xóa mềm); Đã đến = số `customers` stage `visited` có `created_at` trong range (không tính xóa mềm); Chi tiêu/tin nhắn = Chi tiêu ÷ Khách nhắn tin.

#### Scenario: Có dữ liệu
- **WHEN** range có 5.000.000đ chi tiêu và 100 khách nhắn tin
- **THEN** card Chi tiêu/tin nhắn hiển thị 50.000đ

#### Scenario: Không có tin nhắn
- **WHEN** `customer_message_total` = 0
- **THEN** card Chi tiêu/tin nhắn hiển thị "—" (không chia 0)

### Requirement: Quy đổi khoảng ngày VN cho 3 hệ
Với range `[from, to]` dạng `YYYY-MM-DD` (ngày VN, UTC+7), hệ thống SHALL gửi: FB `time_range={"since":from,"until":to}`; SMAX `from = (from − 1 ngày) 17:00:00 +00:00`, `to = to 16:59:59 +00:00`; Supabase lọc `[fromT17:00:00Z hôm trước, toT17:00:00Z)` nửa mở.

#### Scenario: Range một ngày 2026-07-17
- **WHEN** user chọn 17/07/2026 → 17/07/2026
- **THEN** FB nhận `{"since":"2026-07-17","until":"2026-07-17"}`, SMAX nhận `from "2026-07-16 17:00:00 +00:00"` / `to "2026-07-17 16:59:59 +00:00"`, Supabase lọc `>= 2026-07-16T17:00:00Z` và `< 2026-07-17T17:00:00Z`

### Requirement: Bảo mật token và cô lập lỗi nguồn
`FB_TOKEN` và `SMAX_TOKEN` SHALL chỉ được đọc trong server action; server action SHALL từ chối khi chưa đăng nhập. Lỗi của một nguồn SHALL NOT làm hỏng các card còn lại.

#### Scenario: FB lỗi, SMAX sống
- **WHEN** Graph API trả lỗi (token hết hạn)
- **THEN** card Chi tiêu và Chi tiêu/tin nhắn hiển thị "—" kèm thông báo lỗi; 4 card còn lại vẫn hiển thị số

#### Scenario: Gọi action khi chưa đăng nhập
- **WHEN** request không có session gọi server action lấy stats
- **THEN** action trả lỗi, không fetch nguồn nào
