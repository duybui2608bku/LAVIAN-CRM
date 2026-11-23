# tour-roadmap

## ADDED Requirements

### Requirement: Tự sinh tour dự kiến lộ trình mày
Thẻ chưa huỷ có dòng DV nhóm Alis và/hoặc Laser (chưa hoàn) và đã có ít nhất 1 tour thật của các dòng đó SHALL có các tour dự kiến (`planned`) cho phần lộ trình còn lại: các tour Laser còn buổi (nếu chưa có tour Làm mới), rồi Làm mới, rồi Dặm tới hết buổi Alis. Khoảng cách: sau Laser 20 ngày, sau Làm mới / Dặm 45 ngày, tính từ tour đứng trước.

#### Scenario: Mày + Laser 2 buổi
- **WHEN** thẻ có Laser 2 buổi + Shading 2 buổi và tạo tour Laser 1 ngày 01/12
- **THEN** có 3 tour dự kiến: Laser 2 ngày 21/12, Làm mới ngày 10/01, Dặm 1 ngày 24/02

#### Scenario: Chỉ làm mày
- **WHEN** thẻ có Shading 2 buổi (không laser) và tạo tour Làm mới ngày 01/12
- **THEN** có 1 tour dự kiến Dặm 1 ngày 15/01

#### Scenario: Chưa có tour thật
- **WHEN** thẻ vừa tạo, chưa có tour nào
- **THEN** không có tour dự kiến

### Requirement: Tự tính lại lộ trình
Khi tour thật hoặc số buổi / trạng thái dòng DV của thẻ thay đổi, các tour dự kiến SHALL được sinh lại theo quy tắc trên; tour thật SHALL không bị thay đổi.

#### Scenario: Laser sạch sớm
- **WHEN** lộ trình đang Laser 1 (thật) → Laser 2 → Làm mới → Dặm (dự kiến) và Sales bấm "Sạch → lên mới"
- **THEN** số buổi Laser = 1, tour dự kiến còn Làm mới (Laser 1 + 20 ngày) và Dặm 1 (+45 ngày)

#### Scenario: Cần thêm laser
- **WHEN** đã làm Laser 1, Laser 2 (thật, số buổi Laser = 2) và Sales bấm "Còn mực +1 buổi"
- **THEN** số buổi Laser = 3, có tour dự kiến Laser 3 (Laser 2 + 20 ngày), Làm mới và Dặm dời theo

#### Scenario: Dời ngày tour thật
- **WHEN** tour Laser 1 đổi ngày từ 01/12 sang 05/12
- **THEN** các tour dự kiến sau dời thêm 4 ngày

#### Scenario: Hoàn DV mày
- **WHEN** DV Alis của thẻ bị hoàn khi còn tour dự kiến Làm mới / Dặm
- **THEN** các tour dự kiến của DV đó bị xoá mềm

### Requirement: Chốt lịch tour dự kiến
Tour dự kiến SHALL không hiện trong Chờ nhận của KTV, không nhận / gán KTV / xác nhận được, không tính là buổi đã dùng và không vào Đến hạn, Excel, phiếu tour. Người có quyền `tour.edit` hoặc `cards.edit` SHALL chốt lịch được tour dự kiến sớm nhất của thẻ (chọn ngày), khi đó tour thành tour thật và các tour dự kiến sau tính lại theo ngày mới.

#### Scenario: Chốt lịch đổi ngày
- **WHEN** CSKH chốt lịch tour dự kiến Laser 2 (21/12) sang ngày 23/12
- **THEN** Laser 2 thành tour thật ngày 23/12, vào Chờ nhận; Làm mới dự kiến thành 12/01

#### Scenario: Chốt nhảy bước
- **WHEN** chốt lịch tour dự kiến Dặm 1 khi Làm mới vẫn đang dự kiến
- **THEN** báo lỗi phải chốt tour dự kiến sớm nhất trước

#### Scenario: KTV không thấy tour dự kiến
- **WHEN** KTV mở tab Chờ nhận
- **THEN** không có tour dự kiến nào
