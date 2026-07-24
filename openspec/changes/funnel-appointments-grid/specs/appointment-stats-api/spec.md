## ADDED Requirements

### Requirement: Breakdown đặt cọc cho chỉ số kỳ hiện tại
Ba chỉ số kỳ hiện tại của `GET /api/appointments/summary` (`selected`, `newCustomer`, `tomorrow`) SHALL kèm `deposited` (số lịch có ít nhất một payment kind `deposit`, khớp định nghĩa `appointmentBreakdown` của `getMarketingStats`) và `notDeposited` (`count − deposited`). Đếm SHALL dùng head-count với `appointment_payments!inner` (không giới hạn 1.000 row). Số kỳ trước (`previousCount`) giữ nguyên count-only.

#### Scenario: Chỉ số có breakdown đặt cọc
- **WHEN** kỳ chọn có 42 lịch hẹn trong đó 18 lịch có payment kind `deposit`
- **THEN** `data.selected = { count: 42, deposited: 18, notDeposited: 24, previousCount, growthPercent }`
