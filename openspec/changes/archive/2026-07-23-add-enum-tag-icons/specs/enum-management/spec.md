# Spec delta: enum-management

## ADDED Requirements

### Requirement: Admin cấu hình icon và màu tag cho enum option
Trang `/enums` SHALL cho phép admin chọn icon Lucide (qua IconPicker) và màu tag (swatch preset hoặc màu tùy chỉnh hex) khi tạo/sửa một option; cả hai đều tùy chọn (nullable). Bảng `enum_options` SHALL có cột `icon text` và `color text` với ràng buộc định dạng ở DB (`#rrggbb`, kebab-case).

#### Scenario: Gán icon và màu khi sửa option
- **WHEN** admin mở dialog sửa option "new_lead", chọn icon "sparkles" và màu `#4f9cf9`, rồi lưu
- **THEN** hàng `enum_options` được cập nhật `icon='sparkles'`, `color='#4f9cf9'` và bảng /enums hiển thị tag xem trước với icon + màu đó

#### Scenario: Màu sai định dạng bị chặn
- **WHEN** một request ghi `color` không đúng dạng `#rrggbb`
- **THEN** DB từ chối (check constraint) và người dùng nhận thông báo lỗi

### Requirement: Xem trước tag ở bảng danh mục
Bảng option ở `/enums` SHALL hiển thị cột xem trước render option như tag thật (icon + màu + nhãn) để admin thấy ngay kết quả.

#### Scenario: Option chưa cấu hình
- **WHEN** option chưa có icon và màu
- **THEN** cột xem trước hiển thị badge mặc định (không icon, màu trung tính)
