# Delta: customer-management — cột Ghi chú

## ADDED Requirements

### Requirement: Thêm ghi chú nhanh từ bảng khách hàng
Bảng `/customers` SHALL có cột Ghi chú với nút Plus mở Popover chứa ô nhập và nút lưu; lưu thành công SHALL append note mới vào `customers.notes` với `text`, `at` (thời điểm) và `by` (tên người đang đăng nhập) do **server** stamp.

#### Scenario: Thêm note nhanh thành công
- **WHEN** user bấm Plus trên một dòng khách, nhập nội dung và bấm Lưu
- **THEN** note mới `{text, at, by}` được append vào cuối `notes` của khách đó, popover đóng, toast thành công, bảng refresh

#### Scenario: Nội dung rỗng
- **WHEN** ô nhập rỗng hoặc chỉ khoảng trắng
- **THEN** nút Lưu bị disable, không có ghi nào xảy ra

### Requirement: Xem lịch sử ghi chú từ bảng khách hàng
Cột Ghi chú SHALL có nút Info mở Dialog "Lịch sử ghi chú - {tên khách}" liệt kê toàn bộ note **mới nhất trước**, mỗi mục hiển thị thời điểm, người ghi và nội dung. Khách có note SHALL hiển thị badge số lượng note trên nút Info (>9 hiện "9+") để biết đã note hay chưa ngay từ bảng.

#### Scenario: Xem lịch sử
- **WHEN** user bấm Info trên khách có note
- **THEN** dialog hiện danh sách note mới nhất trước, mỗi mục có thời điểm (định dạng locale), tên người ghi và nội dung

#### Scenario: Note cũ không có người ghi
- **WHEN** note được tạo trước thay đổi này (thiếu `by`)
- **THEN** phần người ghi hiển thị "—", các trường còn lại hiển thị bình thường

#### Scenario: Khách chưa có note
- **WHEN** khách không có note nào
- **THEN** nút Info bị disable

## MODIFIED Requirements

### Requirement: Ghi chú trong dialog tạo/sửa khách hàng
Dialog tạo/sửa SHALL gửi nội dung note mới dạng text rời (`CustomerInput.note`); server SHALL stamp `at` + `by` rồi append vào `notes`. Client MUST NOT tự đặt `at`/`by`. Lịch sử note trong dialog sửa SHALL hiển thị kèm người ghi.

#### Scenario: Thêm note khi sửa khách
- **WHEN** user nhập note mới trong dialog sửa và bấm Lưu
- **THEN** server append `{text, at, by}` (by = tên user hiện tại) vào lịch sử hiện có, các note cũ giữ nguyên

#### Scenario: Tạo khách kèm note đầu tiên
- **WHEN** user tạo khách mới và nhập note
- **THEN** khách được tạo với `notes = [{text, at, by}]` do server stamp
