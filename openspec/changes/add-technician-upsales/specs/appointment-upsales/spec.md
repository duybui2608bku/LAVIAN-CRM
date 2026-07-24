## ADDED Requirements

### Requirement: Upsale là record con của lịch hẹn
Hệ thống SHALL cho phép một lịch hẹn có nhiều record upsale con; mỗi record bắt buộc có một dịch vụ, số tiền upsale lớn hơn 0 và tự lưu người tạo cùng thời điểm tạo. Dịch vụ upsale được chọn độc lập với dịch vụ gốc của lịch.

#### Scenario: User đăng nhập thêm upsale
- **WHEN** một user đăng nhập chọn dịch vụ và thêm số tiền hợp lệ vào lịch đang `checked_in` hoặc `completed`
- **THEN** hệ thống tạo một record upsale con thuộc lịch hẹn đó

#### Scenario: Upsale dịch vụ khác dịch vụ gốc
- **WHEN** user chọn một dịch vụ upsale không trùng dịch vụ đang gắn trên lịch
- **THEN** hệ thống vẫn tạo record với đúng `service_id` được chọn

#### Scenario: Thiếu dịch vụ
- **WHEN** user gửi yêu cầu tạo upsale không có dịch vụ hợp lệ
- **THEN** hệ thống từ chối và không tạo record

#### Scenario: Số tiền không hợp lệ
- **WHEN** người dùng nhập số tiền bằng 0, âm hoặc không phải số hữu hạn
- **THEN** hệ thống từ chối và không tạo record

#### Scenario: Lịch chưa có khách đến
- **WHEN** người dùng thêm upsale vào lịch không ở trạng thái `checked_in` hoặc `completed`
- **THEN** hệ thống từ chối và không tạo record

### Requirement: Quyền ghi upsale
Hệ thống MUST cho mọi user đăng nhập tạo upsale trên lịch hợp lệ; record sai SHALL chỉ được xóa bởi người tạo hoặc admin.

#### Scenario: User không phải kỹ thuật viên được phân công
- **WHEN** một user đăng nhập thêm upsale vào lịch hợp lệ bất kể người được phân công
- **THEN** hệ thống vẫn tạo record và lưu user đó ở `created_by`

#### Scenario: Xóa record sai
- **WHEN** người tạo record hoặc admin xác nhận xóa một upsale
- **THEN** hệ thống xóa đúng record đó và cập nhật tổng upsale của lịch

### Requirement: Hiển thị và tính tổng upsale
Hệ thống SHALL hiển thị dịch vụ và số tiền của từng record upsale, đồng thời tính tổng bằng tổng `amount` của các record con.

#### Scenario: Lịch có nhiều record
- **WHEN** lịch hẹn có nhiều khoản upsale
- **THEN** giao diện hiển thị từng khoản và tổng tiền bằng phép cộng tất cả khoản đó

#### Scenario: Lịch chưa có upsale
- **WHEN** lịch hẹn không có record upsale
- **THEN** tổng upsale hiển thị bằng 0

### Requirement: Upsale tham gia Tổng giá và thanh toán
Hệ thống MUST tính Tổng giá phải thanh toán của sổ bằng giá liệu trình gốc cộng tất cả upsale thuộc các lịch dùng chung sổ; công nợ và giới hạn số tiền thu MUST dùng Tổng giá này.

#### Scenario: Thêm upsale làm tăng Tổng giá
- **WHEN** user thêm một upsale hợp lệ vào lịch có sổ
- **THEN** Tổng giá và công nợ của sổ tăng đúng bằng số tiền upsale

#### Scenario: Thanh toán upsale
- **WHEN** sổ có upsale chưa thanh toán
- **THEN** dialog Thanh toán cho phép ghi tiền thu tới tối đa phần còn nợ gồm cả upsale

#### Scenario: Xóa upsale nhập sai
- **WHEN** một upsale bị xóa hợp lệ
- **THEN** Tổng giá và công nợ được tính lại mà không còn khoản upsale đó

#### Scenario: Sổ đã tất toán
- **WHEN** user cố thêm upsale vào lịch thuộc sổ đã tất toán
- **THEN** hệ thống từ chối để upsale mới không nằm ngoài luồng thanh toán

#### Scenario: Xóa upsale đã được thu tiền
- **WHEN** xóa upsale sẽ làm số đã thu vượt Tổng giá còn lại
- **THEN** hệ thống từ chối và yêu cầu điều chỉnh thanh toán trước

### Requirement: Sửa kỹ thuật viên inline
Hệ thống SHALL cho phép user đăng nhập cập nhật kỹ thuật viên trực tiếp tại cột Kỹ thuật viên của bảng lịch hẹn, chỉ nhận profile thuộc bộ phận kỹ thuật đang hoạt động hoặc giá trị rỗng.

#### Scenario: Đổi kỹ thuật viên trên danh sách
- **WHEN** user chọn một kỹ thuật viên đang hoạt động tại ô Kỹ thuật viên
- **THEN** lịch hẹn cập nhật `technician_id` và bảng hiển thị giá trị mới

#### Scenario: Bỏ phân công kỹ thuật viên
- **WHEN** user chọn giá trị không phân công tại ô Kỹ thuật viên
- **THEN** lịch hẹn cập nhật `technician_id = null`

#### Scenario: Giá trị kỹ thuật viên không hợp lệ
- **WHEN** request cập nhật dùng profile không thuộc bộ phận kỹ thuật hoặc không hoạt động
- **THEN** server từ chối và giữ nguyên kỹ thuật viên hiện tại
