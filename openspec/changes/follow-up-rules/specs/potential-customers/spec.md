# potential-customers

## ADDED Requirements

### Requirement: Stage Tiềm năng / Cân nhắc luôn có lịch nhắc
Khách ở stage Tiềm năng hoặc Cân nhắc SHALL luôn có `follow_up_at`, dù đổi stage từ lead form, ô stage trên bảng `/customers` hay drawer tạo/sửa khách. DB SHALL từ chối dòng vi phạm.

#### Scenario: Đổi stage inline
- **WHEN** user chọn Tiềm năng ở ô stage trên bảng `/customers`
- **THEN** hiện hộp chọn "Lịch nhắc follow-up"; chỉ lưu stage khi đã chọn ngày giờ, huỷ thì stage giữ nguyên

#### Scenario: Drawer khách
- **WHEN** user chọn Cân nhắc trong drawer tạo/sửa khách mà không chọn lịch nhắc
- **THEN** form báo "Vui lòng chọn lịch nhắc" và không lưu

### Requirement: Ghi nhận chuyển đổi mọi đường
Khi khách rời Tiềm năng/Cân nhắc sang Đã cọc, Booking, Show-up hoặc Purchase (bất kể từ lead form, sửa inline, drawer, nút chuyển đổi hay trigger Show-up), hệ thống SHALL ghi `converted_at`, đặt `potential_status = converted` và xoá `follow_up_at`.

#### Scenario: Đổi sang Booking từ lead form
- **WHEN** Telesales đổi khách Tiềm năng sang Booking trong lead form
- **THEN** khách được đếm ở thẻ "Chuyển đổi hôm nay"

#### Scenario: Quay lại Tiềm năng
- **WHEN** khách đã chuyển đổi được đặt lại về Tiềm năng
- **THEN** tình trạng "Chuyển đổi đặt lịch" bị bỏ, khách cần lịch nhắc mới

## REMOVED Requirements

### Requirement: Tình trạng "Cân nhắc" (considering)
Tình trạng `considering` bị bỏ vì trùng nghĩa stage Cân nhắc; khách đang cân nhắc dùng stage `consider`.
