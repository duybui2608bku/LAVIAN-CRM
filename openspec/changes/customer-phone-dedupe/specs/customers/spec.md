# customers

## ADDED Requirements

### Requirement: Một SĐT chỉ thuộc một khách
Hệ thống SHALL NOT để 2 khách chưa xoá có cùng SĐT (đã chuẩn hoá), dù tạo/sửa từ `/customers`, drawer tạo lịch hẹn hay lead form.

#### Scenario: Tạo khách trùng SĐT ở CRM
- **WHEN** user tạo hoặc sửa khách với SĐT đang thuộc khách khác
- **THEN** báo "SĐT này đã thuộc khách {tên}" và không lưu

### Requirement: Lead form nhận khách cũ theo SĐT, giữ kênh đầu
Khi không tìm thấy khách theo SMAX id, lead form SHALL dò theo SĐT. Khách tìm theo SĐT được coi là khách cũ; cập nhật SHALL giữ nguyên SMAX id, nguồn và hội thoại của kênh nhắn trước.

#### Scenario: Khách IG chuyển sang WA
- **WHEN** Telesales mở lead form ở hội thoại WA của khách đã có trong CRM từ IG (cùng SĐT)
- **THEN** form hiện thông tin CRM của khách đó, chỉ cho Cập nhật; sau khi cập nhật khách vẫn là nguồn Instagram và không có khách mới
