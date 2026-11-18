# bookings-page

## MODIFIED Requirements

### Requirement: Booking management theo lịch hẹn
`/customers/bookings` SHALL liệt kê lịch hẹn (`clinic_appointments`) thay vì khách theo stage, với cột Lịch hẹn, Khách hàng / Dịch vụ, Deposit, Tele, Nguồn, Trạng thái, Ghi chú (không có cột Nhắc lịch).

#### Scenario: Tab Hôm nay
- **WHEN** user mở trang
- **THEN** mặc định tab Hôm nay, chỉ hiện lịch có ngày hẹn hôm nay, xếp theo giờ

#### Scenario: Cần xử lý
- **WHEN** user bấm tab Cần xử lý
- **THEN** chỉ còn lịch từ hôm nay trở đi, chưa đến, trạng thái Chờ xác nhận hoặc Đổi lịch

#### Scenario: Đã đến
- **WHEN** lịch đã check-in
- **THEN** Trạng thái hiện "Đã đến" và không sửa ở trang này
