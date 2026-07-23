## ADDED Requirements

### Requirement: User có bộ phận
Bảng `public.profiles` SHALL có cột `department` kiểu enum `user_department` với đúng 2 giá trị `customer_care` (Chăm sóc khách hàng) và `technician` (Kỹ Thuật Viên), nullable — user chưa gán bộ phận có `department = null`.

#### Scenario: User cũ chưa gán
- **WHEN** chạy migration trên dữ liệu sẵn có
- **THEN** mọi profile hiện hữu có `department = null`, không lỗi, chạy lại migration an toàn

### Requirement: Admin setup bộ phận tại /users
Trang `/users` SHALL cho admin chọn bộ phận khi tạo user mới (không bắt buộc) và sửa bộ phận của user sẵn có ngay trên bảng (inline select, xóa được về "—"). Ghi DB qua Server Action dùng admin client, chỉ admin gọi được.

#### Scenario: Gán bộ phận cho user sẵn có
- **WHEN** admin chọn "Kỹ Thuật Viên" ở cột Bộ phận của một user
- **THEN** `profiles.department = 'technician'`, bảng hiện nhãn mới, toast thành công

#### Scenario: Tạo user kèm bộ phận
- **WHEN** admin tạo user mới và chọn bộ phận "Chăm sóc khách hàng"
- **THEN** profile tạo ra có `department = 'customer_care'`

#### Scenario: Không phải admin
- **WHEN** user thường gọi action đổi bộ phận
- **THEN** action từ chối (requireAdmin), DB không đổi
