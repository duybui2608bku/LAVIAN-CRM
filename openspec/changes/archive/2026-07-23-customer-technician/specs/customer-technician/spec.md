## ADDED Requirements

### Requirement: Khách hàng có kỹ thuật viên
Bảng `public.customers` SHALL có cột `technician_id uuid` FK → `profiles(id)` `on delete set null`, nullable, kèm partial index (`where deleted_at is null`) — cùng shape với `staff_id`.

#### Scenario: Xóa user đang là kỹ thuật viên của khách
- **WHEN** user (profile) bị xóa khỏi hệ thống
- **THEN** `customers.technician_id` của các khách liên quan tự về `null`, khách không mất

### Requirement: CRUD kỹ thuật viên tại /customers
Trang `/customers` SHALL có cột "Kỹ thuật viên" (avatar + tên như cột Nhân viên, chưa gán hiện "—") sửa được inline, bộ lọc theo kỹ thuật viên trên thanh lọc, và field "Kỹ thuật viên" trong form drawer tạo/sửa khách — ghi qua `createCustomer`/`updateCustomer`/`patchCustomer` (whitelist thêm `technician_id`).

#### Scenario: Sửa inline
- **WHEN** người dùng chọn một kỹ thuật viên ở cell của khách
- **THEN** `customers.technician_id` cập nhật, toast thành công, bảng refresh

#### Scenario: Lọc theo kỹ thuật viên
- **WHEN** chọn một kỹ thuật viên ở bộ lọc
- **THEN** bảng chỉ hiện khách có `technician_id` đó

#### Scenario: Bỏ gán
- **WHEN** người dùng chọn "—" (xóa) ở cell hoặc form
- **THEN** `technician_id = null`

### Requirement: Dropdown kỹ thuật viên chỉ hiện user bộ phận Kỹ Thuật Viên
Mọi dropdown chọn kỹ thuật viên (inline, bộ lọc, form) SHALL chỉ liệt kê profile có `department = 'technician'`, cộng thêm giá trị đang gán của khách dù user đó đã đổi bộ phận (để dữ liệu cũ vẫn hiển thị và bỏ gán được).

#### Scenario: User không thuộc bộ phận kỹ thuật
- **WHEN** mở dropdown kỹ thuật viên
- **THEN** user thuộc "Chăm sóc khách hàng" hoặc chưa gán bộ phận KHÔNG xuất hiện

#### Scenario: Kỹ thuật viên cũ bị đổi bộ phận
- **WHEN** khách đang gán kỹ thuật viên X, X bị đổi sang bộ phận khác
- **THEN** cell vẫn hiện tên X; dropdown của khách đó vẫn có X để giữ hoặc bỏ gán
