# customer-reminders

## ADDED Requirements

### Requirement: Lịch nhắc hẹn cho khách
User có quyền sửa khách SHALL tạo/sửa/xoá/đánh dấu xong lịch nhắc (thời điểm, nội dung) cho khách ở `/customers/bookings`.

#### Scenario: Tạo lịch nhắc
- **WHEN** user bấm cột Nhắc hẹn của khách và thêm lịch nhắc
- **THEN** lịch nhắc được lưu, cột hiển thị lịch nhắc kế tiếp và số lịch chưa xong

#### Scenario: Nhắn khách
- **WHEN** user mở một lịch nhắc của khách có hội thoại SMAX
- **THEN** có nút mở hội thoại và nút sao chép nội dung tin nhắn

### Requirement: Trang calendar lịch nhắc
`/customers/reminders` SHALL hiển thị lịch nhắc theo tháng và theo ngày, lọc được theo nhân viên, trạng thái (chưa xong / quá hạn / đã xong) và tên/SĐT khách.

#### Scenario: Xem lịch nhắc của tôi hôm nay
- **WHEN** user chọn "Của tôi" và bấm "Hôm nay"
- **THEN** panel ngày hiện các lịch nhắc của user trong hôm nay

### Requirement: Thông báo realtime
Chuông header SHALL hiện thông báo của user với badge chưa đọc, nhận thông báo mới không cần tải lại trang. Thông báo lịch nhắc SHALL chỉ gửi cho Telesales phụ trách khách (`customers.staff_id`, đang hoạt động, bộ phận Telesales); khách chưa có Telesales thì không ai nhận. Mỗi 8:00 giờ VN, Telesales có khách với lịch nhắc hôm nay hoặc quá hạn SHALL nhận một thông báo tổng hợp. Khi người khác tạo lịch nhắc cho khách, Telesales của khách SHALL nhận thông báo.

#### Scenario: Không thông báo lung tung
- **WHEN** lịch nhắc thuộc khách chưa có Telesales, hoặc người dùng không phụ trách khách đó
- **THEN** người đó không nhận thông báo

#### Scenario: Thông báo 8h sáng
- **WHEN** 8:00 giờ VN và user là Telesales của khách có lịch nhắc chưa xong trong hôm nay
- **THEN** chuông của user hiện thông báo số lịch nhắc hôm nay, bấm vào mở `/customers/reminders`
