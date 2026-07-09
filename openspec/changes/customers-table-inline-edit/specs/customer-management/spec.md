# Delta: customer-management — inline edit trên bảng, popconfirm xóa, gọn dialog

## ADDED Requirements

### Requirement: Xác nhận xóa khách bằng AlertDialog
Nút xóa khách SHALL mở AlertDialog shadcn (tiêu đề + mô tả + nút Huỷ và nút Xóa kiểu destructive) thay cho `window.confirm`. Xóa chỉ chạy khi user bấm nút Xóa trong dialog.

#### Scenario: Xác nhận xóa
- **WHEN** user bấm nút xóa trên một dòng khách rồi bấm "Xóa" trong AlertDialog
- **THEN** khách bị xóa mềm (`deleted_at`), toast thành công, bảng refresh

#### Scenario: Huỷ xóa
- **WHEN** user bấm nút xóa rồi bấm "Huỷ" (hoặc Esc)
- **THEN** không có ghi nào xảy ra, dialog đóng

### Requirement: Sửa nhanh Giai đoạn / Nguồn / Nhân viên trên bảng
Ô Giai đoạn, Nguồn, Nhân viên của mỗi dòng SHALL là Select inline: hiển thị giá trị hiện tại (tag/tên) làm trigger; chọn giá trị khác SHALL lưu ngay qua server action chỉ cập nhật trường đó, toast + refresh. Nguồn và Nhân viên SHALL bỏ chọn được (về "—"); Giai đoạn MUST luôn có giá trị. Khi đổi Giai đoạn sang khác `lost`, server SHALL xóa `lost_reason` (đồng nhất với quy tắc dialog).

#### Scenario: Đổi giai đoạn inline
- **WHEN** user click tag Giai đoạn trên một dòng và chọn giá trị khác
- **THEN** chỉ `stage` (và `lost_reason` nếu rời khỏi `lost`) của khách đó được cập nhật, toast thành công, bảng refresh

#### Scenario: Bỏ chọn nhân viên
- **WHEN** user click tên Nhân viên và chọn mục bỏ chọn
- **THEN** `staff_id` = null, ô hiển thị "—"

#### Scenario: Lưu lỗi
- **WHEN** server action trả lỗi
- **THEN** toast lỗi, giá trị hiển thị giữ nguyên theo dữ liệu server

## REMOVED Requirements

### Requirement: Ghi chú trong dialog tạo/sửa khách hàng
**Reason**: Trùng chức năng với cột Ghi chú trên bảng (QuickNote popover + dialog lịch sử); form dài không cần thiết; việc dialog gửi lại snapshot `notes` còn gây race đè note thêm từ popover.
**Migration**: Thêm/xem ghi chú dùng cột Ghi chú trên bảng. `CustomerInput` bỏ trường `notes`/`note`; create/update không đụng cột `notes` (DB default `[]`).
