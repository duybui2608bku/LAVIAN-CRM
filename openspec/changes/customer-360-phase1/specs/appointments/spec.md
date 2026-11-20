# appointments

## ADDED Requirements

### Requirement: Giá trị DV không nhỏ hơn số đã thu
Khi Giá trị DV của lịch > 0, server SHALL từ chối lưu nếu Giá trị DV nhỏ hơn Thực thu (Tiền cọc + Thu thêm). Giá trị DV = 0 nghĩa là chưa chốt giá và SHALL được phép lưu.

#### Scenario: Nhập giá thấp hơn số đã thu
- **WHEN** khách đã thu 3.500.000 và Sales nhập Giá trị DV 3.000.000
- **THEN** lưu thất bại với lỗi "Giá trị dịch vụ nhỏ hơn số đã thu"

### Requirement: Ràng buộc người thực hiện theo trạng thái
Lịch chuyển sang "Đang thực hiện" SHALL có Master hoặc Sales phụ trách. Lịch chuyển sang "Đã thực hiện" SHALL có Master. Ràng buộc SHALL được kiểm tra ở cả server và DB.

#### Scenario: Đã thực hiện khi chưa có Master
- **WHEN** Sales chọn "Đã thực hiện" cho lịch chưa có Master
- **THEN** lưu thất bại với lỗi "Cần chọn Master trước khi kết thúc"

### Requirement: Master được xác nhận kết thúc
User bộ phận technician (Master) SHALL được chuyển trạng thái lịch sang "Đã thực hiện". Các trạng thái khác vẫn chỉ Sales và admin được đổi.

#### Scenario: Master kết thúc liệu trình
- **WHEN** Master phụ trách chọn "Đã thực hiện" ở Drawer
- **THEN** lịch được lưu với trạng thái Đã thực hiện

### Requirement: Nhiều người thực hiện kèm vai trò
Drawer lịch hẹn SHALL cho thêm người thực hiện ngoài Master. Mỗi người có một vai trò: Mapping, Phun-xăm, Hỗ trợ (bộ phận technician) hoặc Sales (bộ phận sales). Một người SHALL xuất hiện tối đa một lần trong mỗi lịch.

#### Scenario: Hai Master cùng làm
- **WHEN** lịch có Master Ci Lua, Sales thêm Ci Nu vai trò Phun-xăm
- **THEN** lịch lưu Ci Nu là người thực hiện thêm, và popup hiện "Ci Nu · Phun-xăm"

### Requirement: Mở hồ sơ 360° từ Quản lý bán hàng
Ở Quản lý bán hàng, bấm tên khách SHALL mở popup hồ sơ 360°, còn icon ✎ SHALL mở Drawer nhập liệu. Popup và Drawer SHALL không bao giờ mở cùng lúc.

#### Scenario: Chuyển từ popup sang nhập liệu
- **WHEN** user bấm "Chuyển sang nhập liệu" trong popup
- **THEN** popup đóng và Drawer của lịch gần nhất của khách mở ra
