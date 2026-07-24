# staff-select-department-filter — Delta Spec

## ADDED Requirements

### Requirement: Select chọn người lọc theo bộ phận
Mọi select chọn người theo vai trò SHALL chỉ liệt kê user thuộc đúng bộ phận, cộng thêm giá trị đang gán (user đã đổi bộ phận vẫn hiển thị được — cùng triết lý option inactive):
- Select "Sales" (`sales_id`) → `department = 'sales'` (đã có, giữ nguyên);
- Select "Kỹ thuật viên" (`technician_id`) → `department = 'technician'` (đã có, giữ nguyên);
- Select "Nhân viên" (`staff_id`) tại /customers (bộ lọc, inline bảng, form drawer) → `department = 'customer_care'`;
- Select "Nhân viên tư vấn" tại lead-form (ghi `staff_id`) → chỉ query profiles `department = 'customer_care'`.

#### Scenario: Select Nhân viên tại /customers
- **WHEN** mở bộ lọc/inline/drawer "Nhân viên" và hệ thống có user thuộc các bộ phận khác nhau
- **THEN** danh sách chỉ gồm user `customer_care` + user đang được gán ở dòng/khách đó (nếu khác bộ phận)

#### Scenario: Lead-form chỉ hiện CSKH
- **WHEN** khách mở form public /lead-form
- **THEN** select "Nhân viên tư vấn" chỉ gồm user active thuộc `customer_care` (rỗng thì ẩn select như hiện tại)
