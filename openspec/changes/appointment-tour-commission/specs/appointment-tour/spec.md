## ADDED Requirements

### Requirement: Dịch vụ chi tiết của lịch hẹn
Mỗi lịch hẹn SHALL có tối đa một dịch vụ chi tiết thuộc {Laser, Plasma, New, Debt, Retouch}. Laser, Plasma và Retouch SHALL kèm số lần từ 1 đến 10; New và Debt SHALL NOT có số lần.

#### Scenario: Chọn Retouch lần 2
- **WHEN** user chọn "Retouch 2" trên ô Dịch vụ chi tiết
- **THEN** lịch hẹn lưu `service_detail = 'retouch'`, `service_session = 2`

#### Scenario: Chọn New
- **WHEN** user chọn "New"
- **THEN** lịch hẹn lưu `service_detail = 'new'`, `service_session = null`

#### Scenario: Số lần không hợp lệ
- **WHEN** request gửi Laser với số lần 0, 11, hoặc New kèm số lần
- **THEN** hệ thống từ chối và không lưu

### Requirement: Bill của lịch hẹn
Mỗi lịch hẹn SHALL có thể lưu một số tiền bill là số nguyên ≥ 0 (Rupiah), hoặc để trống.

#### Scenario: Nhập bill âm
- **WHEN** user gửi bill âm hoặc không phải số nguyên
- **THEN** hệ thống từ chối và không lưu

### Requirement: Tính tour kỹ thuật viên
Hệ thống SHALL hiển thị tour = làm tròn(bill × tỷ lệ), với tỷ lệ: Laser 0%, Plasma 0%, New 7%, Debt 7%, Retouch lần 1 3%, Retouch lần ≥ 2 0%. Khi thiếu bill hoặc dịch vụ chi tiết, tour SHALL để trống.

#### Scenario: Khách New, bill 1.000.000
- **WHEN** lịch hẹn có dịch vụ chi tiết New và bill 1.000.000
- **THEN** tour hiển thị 70.000

#### Scenario: Laser lần bất kỳ
- **WHEN** lịch hẹn có Laser lần 3 và bill 2.000.000
- **THEN** tour hiển thị 0

#### Scenario: Retouch lần 1 và lần 2
- **WHEN** bill 1.000.000 với Retouch lần 1, rồi Retouch lần 2
- **THEN** tour lần lượt là 30.000 và 0
