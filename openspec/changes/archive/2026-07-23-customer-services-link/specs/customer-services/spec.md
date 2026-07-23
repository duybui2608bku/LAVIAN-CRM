# Spec: customer-services

## ADDED Requirements

### Requirement: Lưu trữ liên kết khách hàng ↔ dịch vụ
Hệ thống SHALL lưu quan hệ nhiều-nhiều giữa khách hàng và dịch vụ trong bảng `public.customer_services` với khóa ngoại `customer_id → customers(id)` (on delete cascade), `service_id → services(id)` (on delete restrict), khóa chính kép `(customer_id, service_id)`, RLS cho phép mọi user đăng nhập đọc/ghi (đồng nhất bảng `customers`).

#### Scenario: Gắn trùng dịch vụ
- **WHEN** insert 2 dòng cùng `(customer_id, service_id)`
- **THEN** DB từ chối dòng thứ hai (PK kép)

#### Scenario: Xóa cứng khách hàng
- **WHEN** dòng `customers` bị xóa cứng
- **THEN** các dòng nối của khách đó tự xóa theo (cascade)

### Requirement: Gắn dịch vụ khi tạo/sửa khách hàng
Dialog tạo/sửa khách ở `/customers` SHALL cho chọn nhiều dịch vụ bằng multi-select (trigger dạng select hiện badge các dịch vụ đã chọn, popover danh sách toggle có dấu check; chỉ hiện dịch vụ `is_active` + dịch vụ khách đang gắn); lưu SHALL đồng bộ bảng nối theo đúng danh sách đã chọn.

#### Scenario: Bỏ hết dịch vụ
- **WHEN** người dùng bỏ chọn toàn bộ dịch vụ trong multi-select rồi lưu
- **THEN** khách không còn dòng nào trong `customer_services`

#### Scenario: Sửa danh sách dịch vụ
- **WHEN** khách đang gắn A,B và người dùng đổi thành B,C rồi lưu
- **THEN** bảng nối còn đúng B,C

### Requirement: Sửa dịch vụ inline trên bảng khách hàng
Cột "Dịch vụ" trên bảng SHALL là multi-select inline (trigger là chính các badge đang hiển thị): mở popover toggle dịch vụ, và SHALL lưu MỘT lần khi đóng popover nếu danh sách thay đổi (so như tập hợp), qua `patchCustomer` với whitelist thêm `service_ids`.

#### Scenario: Toggle nhiều dịch vụ trong một lần mở
- **WHEN** người dùng mở popover, bật A và tắt B, rồi đóng popover
- **THEN** hệ thống gọi lưu đúng 1 lần với danh sách cuối cùng, toast thành công và refresh

#### Scenario: Đóng popover không đổi gì
- **WHEN** người dùng mở popover rồi đóng mà không toggle (hoặc toggle về lại như cũ)
- **THEN** không gọi lưu, không toast

### Requirement: Hiển thị và lọc theo dịch vụ ở /customers
Bảng khách SHALL có cột "Dịch vụ" hiện tên các dịch vụ đã gắn (badge, theo locale, fallback tiếng Việt; trống → "—"). Thanh lọc SHALL có bộ lọc chọn 1 dịch vụ: chỉ hiện khách có gắn dịch vụ đó, kết hợp AND với các bộ lọc hiện có, xóa được (clear).

#### Scenario: Lọc theo dịch vụ
- **WHEN** chọn dịch vụ X ở bộ lọc
- **THEN** danh sách chỉ còn khách có gắn X

#### Scenario: Khách không có dịch vụ
- **WHEN** khách chưa gắn dịch vụ nào
- **THEN** cột Dịch vụ hiện "—" và khách bị ẩn khi đang lọc theo bất kỳ dịch vụ nào

### Requirement: Chặn xóa dịch vụ đang được dùng
`deleteService` SHALL từ chối xóa khi còn bất kỳ dòng nối nào tới dịch vụ đó (kể cả của khách đã soft-delete — khớp hành vi khóa ngoại restrict), trả thông báo số liên kết đang dùng và gợi ý tắt "Kích hoạt"; khóa ngoại restrict SHALL chặn ở tầng DB làm lưới đỡ cuối.

#### Scenario: Dịch vụ đang được gắn
- **WHEN** admin xóa dịch vụ còn ≥1 dòng nối
- **THEN** action trả lỗi kèm số liên kết đang dùng, không xóa

#### Scenario: Dịch vụ không còn ai dùng
- **WHEN** admin xóa dịch vụ không còn dòng nối nào
- **THEN** dịch vụ bị xóa thành công
