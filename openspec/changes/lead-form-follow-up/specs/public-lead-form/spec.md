# public-lead-form

## MODIFIED Requirements

### Requirement: Lịch nhắc follow-up cho Tiềm năng / Cân nhắc
Khi stage là Tiềm năng hoặc Cân nhắc, lead form SHALL hiện ô "Lịch nhắc follow-up" bắt buộc và lưu vào `customers.follow_up_at`, và SHALL NOT tạo lịch hẹn (`clinic_appointments`). Lịch hẹn tới chi nhánh chỉ bắt buộc khi vừa chọn Booking.

#### Scenario: Khách Tiềm năng
- **WHEN** Telesales chọn stage Tiềm năng, chọn lịch nhắc rồi gửi
- **THEN** khách có `follow_up_at`, hiện ở Khách tiềm năng, không có lịch hẹn mới ở Booking management

#### Scenario: Thiếu lịch nhắc
- **WHEN** chọn Cân nhắc mà không chọn lịch nhắc
- **THEN** form báo "Vui lòng chọn lịch nhắc"
