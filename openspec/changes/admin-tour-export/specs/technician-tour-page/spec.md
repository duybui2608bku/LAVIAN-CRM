## MODIFIED Requirements

### Requirement: Admin xem tour của KTV bất kỳ
Admin SHALL chọn được một kỹ thuật viên hoặc "Tất cả kỹ thuật viên" (mặc định). Khi admin xem, bảng SHALL có cột Nhân viên và có thể gom nhóm theo nhân viên với tổng số lịch, tổng bill, tổng tour mỗi nhóm.

#### Scenario: Admin mở trang
- **WHEN** admin mở `/tour` không có tham số
- **THEN** thấy lịch đã đến trong tháng của mọi KTV, gom theo nhân viên

#### Scenario: Admin chọn KTV
- **WHEN** admin chọn KTV A trong select
- **THEN** trang hiện lịch và tổng tour của A

## ADDED Requirements

### Requirement: Admin xuất Excel tour
Admin SHALL tải được file `.xlsx` các lịch đang hiển thị của tháng, gom theo KTV, có tổng mỗi KTV và tổng cộng.

#### Scenario: Xuất Excel
- **WHEN** admin bấm "Xuất Excel"
- **THEN** trình duyệt tải file `tour-YYYY-MM.xlsx`

### Requirement: Admin xuất phiếu tour PDF tiếng Anh
Admin SHALL in/lưu PDF phiếu tour tiếng Anh, mỗi KTV một trang gồm bảng lịch, tổng tour và chỗ ký.

#### Scenario: Xuất phiếu
- **WHEN** admin bấm "Phiếu tour (PDF)"
- **THEN** hộp thoại in mở với các phiếu tiếng Anh, mỗi KTV một trang
