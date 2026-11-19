# appointments

## ADDED Requirements

### Requirement: Cột Tài chính theo lịch hẹn
Bảng `/appointments` SHALL có cột "Tài chính (IDR)" gồm 2 dòng: Deposit (tiền cọc của khách, chỉ xem) và Giá trị DV (bill của lịch hẹn). User có quyền `appointments.edit` SHALL sửa được Giá trị DV ngay trên bảng; giá trị âm bị từ chối.

#### Scenario: Nhập giá trị dịch vụ
- **WHEN** user nhập 3.500.000 vào Giá trị DV của một lịch rồi rời ô
- **THEN** lịch lưu `bill_amount = 3500000`, bảng hiện "3.500.000", lịch sử lịch hẹn ghi thay đổi

#### Scenario: Khách chưa cọc
- **WHEN** khách của lịch không có tiền cọc
- **THEN** dòng Deposit hiện 0

### Requirement: Master (KTV) theo lịch hẹn
Bảng `/appointments` SHALL có cột Master để gán 1 kỹ thuật viên (user đang hoạt động, bộ phận `technician`) cho từng lịch. Lịch chưa gán SHALL hiện "Chưa phân công". Server SHALL từ chối user không thuộc bộ phận KTV.

#### Scenario: Gán Master
- **WHEN** user chọn KTV "Ci Lua" ở cột Master
- **THEN** lịch lưu `technician_id` của Ci Lua và hiện avatar + tên

### Requirement: Nhóm dịch vụ hiển thị cạnh SĐT
Bảng `/appointments` SHALL không còn cột Nhóm dịch vụ; nhóm dịch vụ SHALL hiện sau SĐT trong ô Khách hàng và vẫn sửa được (chọn nhiều) khi có quyền.

#### Scenario: Lịch có nhóm Sulam Alis
- **WHEN** lịch có nhóm dịch vụ `alis`
- **THEN** ô Khách hàng hiện dòng phụ "0812… · Sulam Alis"

### Requirement: Drawer thông tin khách hàng
Ô Khách hàng SHALL có icon mở drawer chỉ xem toàn bộ thông tin khách (tên, SĐT, tên MXH, nguồn, giai đoạn, Telesales/Sales/KTV phụ trách, ngày liên hệ đầu, lịch nhắc, tiền cọc + ảnh xác nhận, khu vực, địa chỉ, ngày tạo, ghi chú). Dữ liệu SHALL tải khi mở drawer.

#### Scenario: Mở drawer
- **WHEN** user bấm icon cạnh tên khách
- **THEN** drawer phải mở, hiện skeleton rồi đến thông tin khách đó

## REMOVED Requirements

### Requirement: Cột Telesales trên bảng Lịch hẹn
Cột Telesales bị ẩn khỏi `/appointments` (vẫn chọn được ở form Thêm lịch hẹn; dữ liệu `staff_id` giữ nguyên).
