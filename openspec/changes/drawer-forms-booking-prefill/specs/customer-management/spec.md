# Delta: customer-management — form khách hàng dạng drawer

## ADDED Requirements

### Requirement: Form tạo/sửa khách hàng hiển thị dạng drawer bên phải
Form tạo/sửa khách hàng SHALL hiển thị bằng Sheet (drawer) trượt từ cạnh phải, cao toàn màn hình, thay cho Dialog giữa màn hình. Toàn bộ trường nhập, validation và hành vi submit SHALL giữ nguyên như dialog cũ. Phần trường nhập SHALL cuộn độc lập bên trong drawer; hàng nút Hủy/Lưu SHALL luôn dính đáy drawer.

#### Scenario: Mở form thêm khách
- **WHEN** người dùng bấm nút Thêm khách hàng ở /customers
- **THEN** drawer trượt vào từ cạnh phải, chứa đầy đủ các trường như dialog cũ, nút Hủy/Lưu ở đáy

#### Scenario: Form dài hơn màn hình
- **WHEN** nội dung form vượt chiều cao màn hình (ví dụ stage = lost hiện thêm Lý do mất)
- **THEN** chỉ phần trường nhập cuộn, tiêu đề và hàng nút vẫn cố định

#### Scenario: Đóng drawer
- **WHEN** người dùng bấm X, bấm Hủy, nhấn Esc hoặc click ra ngoài
- **THEN** drawer đóng, không lưu thay đổi
