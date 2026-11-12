## ADDED Requirements

### Requirement: Schema chỉ chứa đối tượng đang dùng
DB `public` SHALL không giữ bảng, cột, function, trigger hay dòng danh mục mà code không còn đọc/ghi.

#### Scenario: Bảng hệ lịch hẹn cũ
- **WHEN** chạy migration dọn dẹp
- **THEN** các bảng `appointments`, `appointment_*`, `service_ledgers`, `money_audit`, `customer_services` không còn tồn tại
- **AND** `clinic_appointments`, `tours`, `customers` giữ nguyên dữ liệu

### Requirement: Query trang chỉ lấy cột cần hiển thị
Trang danh sách SHALL không tải cột jsonb lớn rồi bỏ ở server.

#### Scenario: Mở /customers
- **WHEN** tải trang Khách hàng
- **THEN** query không chọn `smax_data`/`tags`; username Instagram lấy qua JSON path
