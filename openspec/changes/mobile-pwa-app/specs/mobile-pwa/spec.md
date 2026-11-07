## ADDED Requirements

### Requirement: Đăng xuất sạch
Sau khi xác nhận đăng xuất, app SHALL đưa người dùng về `/login` không còn hộp thoại, menu hay dữ liệu của phiên cũ.

#### Scenario: Đăng xuất từ menu tài khoản
- **WHEN** người dùng bấm "Đăng xuất" và xác nhận
- **THEN** trang `/login` hiện ra, không còn hộp xác nhận nào

### Requirement: Select cuộn mượt trên cảm ứng
Trên thiết bị cảm ứng, danh sách dropdown SHALL cuộn native (có quán tính) và kéo hết danh sách SHALL NOT cuộn trang phía sau.

#### Scenario: Chọn khách hàng trong danh sách dài
- **WHEN** CSKH mở select "Khách hàng" trong drawer tạo tour và vuốt danh sách
- **THEN** danh sách cuộn mượt, dropdown không nhảy vị trí

### Requirement: Cài như app điện thoại
App SHALL có web app manifest (`display: standalone`, icon 192/512) và trên màn hình < 768px SHALL điều hướng bằng thanh tab dưới, tôn trọng vùng an toàn (tai thỏ, thanh home).

#### Scenario: Thêm vào màn hình chính
- **WHEN** người dùng chọn "Thêm vào màn hình chính" và mở từ icon
- **THEN** app mở toàn màn hình, không thanh địa chỉ, thanh tab dưới không bị thanh home che

#### Scenario: Chuyển trang bằng tab
- **WHEN** người dùng chạm tab "Lịch hẹn"
- **THEN** trang Lịch hẹn mở và tab được tô sáng
