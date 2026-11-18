# potential-customers

## ADDED Requirements

### Requirement: Stage Consider
Ô Status khách SHALL có thêm stage `consider` (Consider / Cân nhắc).

#### Scenario: Chọn stage Consider
- **WHEN** user sửa Status khách thành Consider
- **THEN** khách được lưu với `stage = consider`

### Requirement: Trang khách tiềm năng
`/customers/potential` SHALL liệt kê khách `stage = potential` với cột Khách hàng (tên, SĐT, ghi chú gần nhất), Ngày tạo, Nguồn, Tele, Tình trạng (+ số lần follow-up = số ghi chú), Ngày giờ liên hệ lại; 4 card số liệu; lọc tìm / Tele / Tình trạng và tab Tất cả / Quá hạn / Hôm nay / Sắp tới.

#### Scenario: Lọc quá hạn
- **WHEN** user bấm tab Quá hạn
- **THEN** chỉ còn khách có ngày giờ liên hệ lại trước thời điểm hiện tại

#### Scenario: Ghi chú
- **WHEN** user bấm icon ở cột Khách hàng và thêm ghi chú
- **THEN** ghi chú lưu kèm người ghi + thời gian, dòng thứ 3 hiện ghi chú mới, số follow-up tăng 1

### Requirement: Chuyển đổi đặt lịch
Chọn Tình trạng "Chuyển đổi đặt lịch" SHALL mở form tạo lịch hẹn; chỉ khi tạo lịch thành công khách mới chuyển sang stage Booking.

#### Scenario: Tạo lịch thành công
- **WHEN** user chọn Chuyển đổi đặt lịch và tạo lịch hẹn
- **THEN** khách sang stage Booking, rời trang, card "Chuyển đổi booking hôm nay" tăng 1

#### Scenario: Huỷ
- **WHEN** user đóng form tạo lịch hẹn
- **THEN** Tình trạng và stage không đổi

### Requirement: Thông báo liên hệ lại
Telesales phụ trách khách (active, bộ phận Telesales) SHALL nhận thông báo khi tới ngày giờ liên hệ lại (trễ tối đa ~5 phút, mỗi mốc 1 lần) và một thông báo tổng hợp lúc 8:00 giờ VN nếu có khách cần liên hệ hôm nay hoặc quá hạn.

#### Scenario: Tới giờ hẹn
- **WHEN** tới `follow_up_at` của khách tiềm năng có Telesales
- **THEN** Telesales đó nhận 1 thông báo realtime ở chuông, bấm mở trang khách tiềm năng

#### Scenario: Dời hẹn
- **WHEN** user đổi ngày giờ liên hệ lại sau khi đã được báo
- **THEN** tới giờ mới Telesales được báo lại
