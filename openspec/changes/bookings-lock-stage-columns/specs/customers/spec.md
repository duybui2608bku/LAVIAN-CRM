# customers

## ADDED Requirements

### Requirement: Booking management khoá Stage và ưu tiên cột Lịch hẹn
Trang `/customers/bookings` SHALL hiển thị Stage chỉ để xem (bảng và drawer sửa khách không cho đổi). Bảng SHALL có cột Lịch hẹn ở đầu và cột Ngày tạo ở cuối. Trang `/customers` SHALL giữ nguyên hành vi.

#### Scenario: Không đổi stage trên Booking management
- **WHEN** user có quyền sửa khách mở `/customers/bookings`
- **THEN** ô Stage trên bảng và trong drawer sửa khách bị khoá

#### Scenario: Thứ tự cột
- **WHEN** user mở `/customers/bookings`
- **THEN** cột đầu là Lịch hẹn, cột cuối là Ngày tạo
