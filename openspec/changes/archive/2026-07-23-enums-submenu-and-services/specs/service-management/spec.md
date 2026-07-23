# service-management

## ADDED Requirements

### Requirement: Bảng services đa ngôn ngữ
Hệ thống SHALL lưu danh mục dịch vụ trong bảng `public.services` với tên tiếng Việt bắt buộc (`name_vi`) và tên En/Id tùy chọn (`name_en`, `name_id` nullable — đa ngôn ngữ không bắt buộc), `sort_order`, `is_active`, timestamps tự cập nhật. RLS: mọi user đăng nhập đọc được; chỉ admin ghi.

#### Scenario: User thường đọc, không ghi được
- **WHEN** user role `user` select bảng `services`
- **THEN** đọc được các dòng; mọi insert/update/delete bị RLS chặn

#### Scenario: Trigger updated_at
- **WHEN** một dòng service được update
- **THEN** `updated_at` tự đặt lại `now()`

### Requirement: Trang CRUD /services (admin)
Hệ thống SHALL cung cấp trang `/services` chỉ admin truy cập (proxy chặn + `requireAdmin()` trong page/actions) hiển thị bảng dịch vụ (tên vi/en/id, kích hoạt, thao tác) sắp theo `sort_order`, với dialog thêm/sửa (chỉ tên tiếng Việt bắt buộc — En/Id tùy chọn, thứ tự, kích hoạt), toggle kích hoạt trực tiếp trong bảng và xóa có xác nhận. Cột En/Id trống hiển thị "—".

#### Scenario: Non-admin bị chặn
- **WHEN** user role `user` mở `/services`
- **THEN** proxy redirect về `/`

#### Scenario: Tạo dịch vụ
- **WHEN** admin mở dialog Thêm, chỉ nhập tên tiếng Việt và Lưu
- **THEN** dòng mới xuất hiện trong bảng (cột En/Id hiện "—"), toast thành công

#### Scenario: Toggle kích hoạt
- **WHEN** admin bấm checkbox Kích hoạt trên một dòng
- **THEN** `is_active` đảo giá trị, các trường khác giữ nguyên

#### Scenario: Xóa dịch vụ
- **WHEN** admin bấm Xóa và xác nhận
- **THEN** dòng bị xóa khỏi bảng, toast thành công

### Requirement: i18n cho giao diện services
Giao diện `/services` và mục menu SHALL có bản dịch đầy đủ ở cả 3 locale vi/en/id (namespace `services`, key `nav.services`).

#### Scenario: Đổi ngôn ngữ
- **WHEN** user đổi locale sang en hoặc id
- **THEN** tiêu đề, cột, nút, toast của trang /services hiển thị đúng ngôn ngữ đó
