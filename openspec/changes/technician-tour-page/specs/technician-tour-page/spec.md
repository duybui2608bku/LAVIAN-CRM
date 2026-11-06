## ADDED Requirements

### Requirement: Kỹ thuật viên xem tour của mình theo tháng
Hệ thống SHALL có trang `/tour` liệt kê các lịch hẹn đã đến (`checked_in`) có `technician_id` là user đang đăng nhập trong tháng được chọn, kèm tour từng lịch và tổng tour, tổng bill, số lịch.

#### Scenario: KTV mở trang
- **WHEN** KTV mở `/tour`
- **THEN** thấy lịch đã đến trong tháng hiện tại của chính mình và tổng tour

#### Scenario: Lịch chưa đến không tính
- **WHEN** một lịch của KTV chưa đánh dấu khách đến
- **THEN** lịch đó không hiện trên trang

#### Scenario: Non-admin cố xem người khác
- **WHEN** user không phải admin mở `/tour?technician=<id khác>`
- **THEN** trang vẫn hiện dữ liệu của chính user đó

### Requirement: Admin xem tour của KTV bất kỳ
Admin SHALL chọn được một kỹ thuật viên để xem trang tour của người đó.

#### Scenario: Admin chọn KTV
- **WHEN** admin chọn KTV A trong select
- **THEN** trang hiện lịch và tổng tour của A
