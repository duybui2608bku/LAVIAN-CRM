# treatment-journey

## ADDED Requirements

### Requirement: Loại tour Laser / Làm mới / Dặm
Mỗi tour SHALL hiển thị Loại: "Laser n", "Làm mới" hoặc "Dặm n" (dữ liệu cũ: "Plasma n", "Debt"). Loại SHALL lưu trong `tours.service_detail` + `service_session`; số n SHALL do server tính theo các tour cùng dòng dịch vụ của thẻ, không nhập tay.

#### Scenario: Gợi ý Loại khi tạo tour từ thẻ
- **WHEN** Sales mở Tạo tour cho thẻ có "Laser Removal" (chưa có tour) và "Hairstroke 6D" (đã có 1 tour Làm mới)
- **THEN** dòng Laser Removal gợi ý "Laser 1", dòng Hairstroke 6D gợi ý "Dặm 1"

#### Scenario: Sửa Loại ở drawer tour
- **WHEN** Sales đổi Loại tour từ "Làm mới" sang "Dặm" khi dòng dịch vụ đã có 1 tour Làm mới khác
- **THEN** tour lưu thành "Dặm 1"

### Requirement: Đến hạn kiểm tra laser
Thẻ chưa huỷ có tour cuối cùng (theo ngày tour) là Laser hoặc Plasma VÀ còn ít nhất một dịch vụ chưa hoàn chưa dùng hết buổi SHALL có mục "Kiểm tra laser" hạn = ngày tour đó + 20 ngày.

#### Scenario: Laser xong chờ kiểm tra
- **WHEN** thẻ có tour Laser 1 ngày 01/12, chưa có tour nào sau đó
- **THEN** Đến hạn liệu trình có "Kiểm tra laser" hạn 21/12

#### Scenario: Kiểm tra OK
- **WHEN** sau tour Laser 1 có tour Làm mới Hairstroke ngày 21/12
- **THEN** mục Kiểm tra laser biến mất và xuất hiện "Dặm 1 · Hairstroke" hạn 04/02 (nếu Hairstroke còn buổi)

#### Scenario: Kiểm tra chưa OK
- **WHEN** sau tour Laser 1 có tour Laser 2 ngày 21/12
- **THEN** mục Kiểm tra laser hạn 10/01

### Requirement: Đến hạn dặm
Mỗi dịch vụ chưa hoàn, không phải laser, có tour cuối là Làm mới hoặc Dặm VÀ số tour < số buổi SHALL có mục "Dặm n" hạn = ngày tour đó + 45 ngày, trừ khi tour cuối của cả thẻ là Laser (đang chờ kiểm tra).

#### Scenario: Hết buổi
- **WHEN** dịch vụ 2 buổi đã có tour Làm mới và Dặm 1
- **THEN** không có mục đến hạn cho dịch vụ đó

#### Scenario: Đã hẹn tour tiếp
- **WHEN** đã tạo tour Dặm 1 ngày tương lai cho dịch vụ đang đến hạn dặm
- **THEN** mục đến hạn tính theo tour mới (hạn = ngày tour mới + 45 nếu còn buổi, hoặc biến mất nếu hết buổi)

### Requirement: Danh sách Đến hạn liệu trình
Trang Thẻ liệu trình SHALL có tab "Đến hạn" liệt kê các mục đến hạn (khách, thẻ, việc, dịch vụ, tour gần nhất, ngày hạn, Sales bán thẻ), sắp theo hạn tăng dần, lọc Quá hạn / Hôm nay / Sắp tới (≤ 7 ngày) / Tất cả và lọc Sales. Người không phải admin SHALL mặc định thấy thẻ do mình tạo. Danh sách SHALL tự tính từ thẻ + tour, không lưu bản ghi nhắc.

#### Scenario: Sales mở tab Đến hạn
- **WHEN** Sales A mở tab Đến hạn
- **THEN** thấy các mục của thẻ do A tạo, mục quá hạn hiện tag đỏ "Quá hạn N ngày"

### Requirement: Sửa số buổi dịch vụ trong thẻ
Người có quyền `cards.edit` SHALL sửa được số buổi của dịch vụ chưa hoàn trong thẻ chưa huỷ, trong khoảng [số tour đã có (tối thiểu 1), 100].

#### Scenario: Giảm số buổi dưới số đã làm
- **WHEN** dịch vụ đã có 2 tour và Sales nhập số buổi 1
- **THEN** lưu thất bại, báo số buổi không được nhỏ hơn số buổi đã làm
