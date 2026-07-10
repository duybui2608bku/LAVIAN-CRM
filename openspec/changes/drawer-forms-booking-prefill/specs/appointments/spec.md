# Delta: appointments — form đặt lịch dạng drawer + prefill theo khách

## ADDED Requirements

### Requirement: Form đặt lịch hiển thị dạng drawer bên phải
Form tạo/sửa lịch hẹn SHALL hiển thị bằng Sheet (drawer) trượt từ cạnh phải, cao toàn màn hình, dùng chung cho /appointments và nút Đặt lịch ở /customers. Toàn bộ trường nhập, validation và hành vi submit SHALL giữ nguyên. Phần trường nhập SHALL cuộn độc lập; hàng nút Hủy/Lưu SHALL dính đáy drawer.

#### Scenario: Mở form đặt lịch
- **WHEN** người dùng bấm Đặt lịch (ở /appointments hoặc /customers)
- **THEN** drawer trượt vào từ cạnh phải với đầy đủ trường như dialog cũ

### Requirement: Tạo lịch mới tự điền thông tin ban đầu của khách
Khi TẠO MỚI lịch hẹn, form SHALL tự điền Nguồn (`source`), Dịch vụ (`service_ids`) và Nhân viên (`staff_id`) từ hồ sơ khách được chọn. Khi SỬA lịch hẹn, form SHALL giữ nguyên dữ liệu của chính lịch hẹn, KHÔNG lấy lại từ khách.

#### Scenario: Đặt lịch từ /customers (khách khóa cứng)
- **WHEN** người dùng bấm Đặt lịch trên 1 dòng khách có Nguồn/Dịch vụ/Nhân viên
- **THEN** drawer mở với 3 trường đó đã điền sẵn theo hồ sơ khách

#### Scenario: Chọn khách trong select ở /appointments
- **WHEN** người dùng đang tạo lịch mới và chọn (hoặc đổi) khách trong select
- **THEN** 3 trường Nguồn/Dịch vụ/Nhân viên được set lại theo khách vừa chọn; các trường khác (ngày giờ, tiền, ghi chú) giữ nguyên giá trị đang nhập

#### Scenario: Khách không có thông tin
- **WHEN** khách được chọn chưa có Nguồn/Dịch vụ/Nhân viên
- **THEN** các trường tương ứng để trống (không giữ giá trị của khách trước đó)

#### Scenario: Sửa lịch hẹn
- **WHEN** người dùng mở form sửa 1 lịch hẹn đã có
- **THEN** form hiển thị đúng dữ liệu của lịch hẹn, không prefill lại từ hồ sơ khách
