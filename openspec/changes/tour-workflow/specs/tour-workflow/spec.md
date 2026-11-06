## ADDED Requirements

### Requirement: Lịch hẹn chỉ lưu lịch đến
Trang Lịch hẹn SHALL chỉ gồm khách, ngày giờ, xác nhận đến, dịch vụ, CSKH, ghi chú; KHÔNG có thanh toán, KTV, dịch vụ chi tiết, bill, tour.

#### Scenario: Mở Lịch hẹn
- **WHEN** nhân viên mở `/appointments`
- **THEN** bảng và drawer tạo không có các cột thanh toán, KTV, dịch vụ chi tiết, bill, tour

### Requirement: CSKH tạo tour
Nhân viên SHALL tạo tour với ngày, khách, dịch vụ và ghi chú; tour mới ở trạng thái Chờ nhận.

#### Scenario: Tạo tour
- **WHEN** CSKH tạo tour cho khách A, dịch vụ Mày
- **THEN** tour xuất hiện trong danh sách Chờ nhận của KTV

### Requirement: KTV nhận tour
KTV SHALL thấy danh sách tour chờ nhận và nhận được tour; mỗi tour chỉ một KTV nhận.

#### Scenario: Nhận tour
- **WHEN** KTV bấm "Nhận tour"
- **THEN** tên KTV được gán vào tour và tour chuyển sang Tour của tôi

#### Scenario: Hai KTV nhận cùng lúc
- **WHEN** KTV B nhận tour mà KTV A vừa nhận
- **THEN** B nhận thông báo tour đã có người nhận

### Requirement: KTV điền chi tiết và ảnh
KTV SHALL chọn dịch vụ chi tiết, lần, bill, phương thức thanh toán và chụp ảnh trước/sau/thêm cho tour của mình; ảnh được tải lên và lưu ngay sau khi chụp. Thực thu SHALL tự tính = bill × % theo dịch vụ chi tiết và lần.

#### Scenario: Chụp ảnh trước khi làm
- **WHEN** KTV bấm "Chụp" ở mục Ảnh trước trên điện thoại
- **THEN** camera mở, chụp xong ảnh được tải lên và hiện trong tour

#### Scenario: Thực thu Retouch lần 1
- **WHEN** dịch vụ chi tiết Retouch, lần 1, bill 1.000.000
- **THEN** thực thu là 30.000

### Requirement: Admin xác nhận tour
Chỉ admin SHALL xác nhận / bỏ xác nhận tour; tour đã xác nhận không ai ngoài admin sửa được.

#### Scenario: KTV sửa tour đã xác nhận
- **WHEN** KTV sửa tour đã được admin xác nhận
- **THEN** thao tác bị từ chối

### Requirement: KTV xem tour của mình theo tháng
KTV SHALL thấy tour của mình theo tháng với trạng thái đã/chưa xác nhận, tổng số tour và tổng thực thu.

#### Scenario: Xem tháng
- **WHEN** KTV chọn tháng 11
- **THEN** thấy các tour tháng 11 của mình và tổng tour tháng
