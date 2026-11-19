# appointments

## ADDED Requirements

### Requirement: Trạng thái lịch hẹn 5 bước
Mỗi lịch hẹn SHALL có Status ∈ Chưa đến, Đã đến, Đang thực hiện, Đã thực hiện, Đổi lịch (mặc định Chưa đến). Chỉ bộ phận Sales và admin SHALL đổi được Status. Status Đã đến / Đang thực hiện / Đã thực hiện SHALL được tính là khách đã đến (`checked_in`) cho báo cáo và chuyển stage Show-up.

#### Scenario: Sales chuyển Đang thực hiện
- **WHEN** Sales đổi Status của lịch đang "Chưa đến" sang "Đang thực hiện"
- **THEN** lịch được tính là đã đến và khách tự chuyển stage Show-up (nếu chưa Show-up/Purchase)

#### Scenario: Đổi lịch
- **WHEN** Sales đổi Status từ "Đã đến" sang "Đổi lịch" và khách không còn lịch nào đã đến
- **THEN** lịch không còn được tính là đã đến, khách quay về stage Booking

#### Scenario: Telesales không đổi được
- **WHEN** user bộ phận Telesales gửi đổi Status
- **THEN** server từ chối với thông báo chỉ Sales được đổi

### Requirement: Sales Status ở trang khách
Trang Khách hàng và Khách tiềm năng SHALL có cột Sales Status (chỉ xem) cạnh cột Stage / Status, hiện Status của lịch hẹn gần nhất của khách (lịch sắp tới sớm nhất, không có thì lịch đã qua gần nhất). Khách chưa có lịch SHALL hiện "—".

#### Scenario: Khách có lịch đang thực hiện
- **WHEN** lịch gần nhất của khách có Status "Đang thực hiện"
- **THEN** cột Sales Status của khách hiện tag "Đang thực hiện"

## MODIFIED Requirements

### Requirement: Clinic confirmation
Cột "Clinic confirmation" (Đã đến / Chưa đến) ở `/appointments` đổi thành cột Status 5 trạng thái ở trên.
