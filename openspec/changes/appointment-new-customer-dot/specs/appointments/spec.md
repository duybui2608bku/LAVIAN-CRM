# appointments

## ADDED Requirements

### Requirement: Chấm khách mới ở Sales Management
Bảng `/appointments` SHALL hiện chấm tròn xanh cạnh tên khách khi lịch hẹn đó là của khách mới: khách không có lịch hẹn nào (chưa xoá) có Status Đã đến / Đang thực hiện / Đã thực hiện với ngày giờ hẹn sớm hơn lịch này. Lịch của khách cũ SHALL không có chấm.

#### Scenario: Lần đầu đến
- **WHEN** khách có 1 lịch duy nhất, Status "Đang thực hiện"
- **THEN** lịch đó hiện chấm xanh

#### Scenario: Khách quay lại Retouch
- **WHEN** khách đã có lịch 10/11 Status "Đã thực hiện" và lịch mới 18/11
- **THEN** lịch 18/11 không có chấm, lịch 10/11 vẫn có chấm

#### Scenario: Lần trước không đến
- **WHEN** lịch trước của khách có Status "Đổi lịch" và chưa từng có lịch đã đến
- **THEN** lịch mới vẫn hiện chấm xanh
