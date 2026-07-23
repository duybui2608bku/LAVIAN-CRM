# customer-management — delta: customers-user-avatars

## ADDED Requirements

### Requirement: Cột Nhân viên hiển thị avatar
Cột Nhân viên trên bảng /customers SHALL hiển thị avatar tròn nhỏ cạnh tên nhân viên phụ trách; nếu `avatar_url` rỗng SHALL dùng ảnh fallback `app/assets/avt.webp`.

#### Scenario: Khách có nhân viên phụ trách
- **WHEN** khách hàng có `staff_id` trỏ tới profile có `avatar_url`
- **THEN** cell Nhân viên hiển thị avatar (ảnh tròn) + tên, vẫn bấm được để đổi inline

#### Scenario: Nhân viên chưa có avatar
- **WHEN** profile của nhân viên không có `avatar_url`
- **THEN** cell hiển thị ảnh fallback mặc định + tên

#### Scenario: Chưa gán nhân viên
- **WHEN** khách hàng có `staff_id = null`
- **THEN** cell hiển thị "—", không có avatar

#### Scenario: Option trong dropdown chọn nhân viên
- **WHEN** người dùng mở Select nhân viên (inline trên bảng, thanh lọc, hoặc dialog tạo/sửa)
- **THEN** mỗi option nhân viên hiển thị avatar + tên (option "— Không —" không có avatar)

### Requirement: Lịch sử ghi chú hiển thị avatar người ghi
Dialog Lịch sử ghi chú SHALL hiển thị avatar người ghi cạnh tên (`by`), tra theo `user_name` trong danh sách profiles; không tìm thấy SHALL dùng ảnh fallback.

#### Scenario: Note có người ghi
- **WHEN** note có `by` khớp `user_name` của một profile
- **THEN** mục note hiển thị avatar của profile đó + tên người ghi

#### Scenario: Note cũ không có người ghi
- **WHEN** note có `by` rỗng/null
- **THEN** mục note hiển thị "—" và KHÔNG hiển thị avatar
