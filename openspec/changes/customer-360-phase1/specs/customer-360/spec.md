# customer-360

## ADDED Requirements

### Requirement: Popup hồ sơ khách theo Customer ID
Hệ thống SHALL có popup Customer Detail 360° mở theo `customer_id`, gom toàn bộ lịch hẹn, tài chính, chân dung, nhu cầu, ghi chú và hội thoại của khách trên một hồ sơ duy nhất, bất kể mở từ lịch hẹn nào.

#### Scenario: Khách có 3 lịch hẹn
- **WHEN** khách có 3 lịch (làm mày, dặm, làm môi) và user mở popup từ lịch dặm
- **THEN** popup hiện cùng một hồ sơ khách với cả 3 lịch trong lịch sử mua và dòng thời gian

### Requirement: Điều hướng Trước / Tiếp theo danh sách đang lọc
Nút Trước/Tiếp SHALL đi lần lượt theo danh sách khách mà bảng gọi popup đang hiển thị (sau lọc, tìm kiếm, sắp xếp; mỗi khách xuất hiện một lần). Ở khách đầu, nút Trước SHALL bị khoá; ở khách cuối, nút Tiếp SHALL bị khoá. Đóng popup SHALL giữ nguyên bộ lọc, trang và vị trí cuộn của bảng.

#### Scenario: Đang lọc Hôm nay
- **WHEN** bảng đang lọc "Hôm nay" có 4 khách và user đang xem khách thứ 4
- **THEN** popup hiện "4/4" và nút Tiếp bị khoá

### Requirement: Hiển thị theo vai trò tài khoản
Popup SHALL tự xác định vai trò theo bộ phận của user đăng nhập và hiện gợi ý tương ứng. Telesales và Master SHALL không thấy dữ liệu tài chính. Telesales SHALL không thấy ảnh B/A. Server SHALL không trả dữ liệu bị ẩn.

#### Scenario: Telesales mở popup
- **WHEN** user bộ phận telesales mở popup
- **THEN** không có vùng Tài chính và tab Ảnh B/A, và phản hồi từ server không chứa số tiền hay ảnh

### Requirement: Chân dung khách có nguồn và lịch sử
Mọi bộ phận SHALL nhập được 6 mục chân dung (Mong muốn, Nỗi lo, Sở thích, Hành vi quyết định, Giao tiếp phù hợp, Tính cách). Mỗi lần nhập SHALL gắn nguồn "Khách nói" hoặc "NV nhận định", và MAY gắn tin nhắn SMAX gốc. Giao diện SHALL hiện bản mới nhất của từng mục. Mọi bản cũ SHALL được giữ kèm người nhập và thời điểm, và không ai sửa hay xoá được.

#### Scenario: Cập nhật Nỗi lo
- **WHEN** Sales nhập Nỗi lo "Sợ mày quá đậm", nguồn Khách nói, gắn tin nhắn gốc
- **THEN** ô Nỗi lo hiện nội dung mới kèm nhãn Khách nói, và lịch sử của mục hiện cả bản cũ lẫn bản mới, có tên người nhập và giờ

### Requirement: Nhu cầu tiếp theo dạng pipeline
Nhu cầu của khách SHALL là một nguồn dữ liệu duy nhất, hiện ở ô "Nhu cầu tiếp theo" và ở tab Dịch vụ & Upsell. Mỗi nhu cầu SHALL có nguồn ([Khách đã hỏi] / [Sales khai thác]) và trạng thái Nhu cầu → Tư vấn → Upsell → Thành công / Thất bại, lưu lịch sử đổi trạng thái.

#### Scenario: Ghi nhận và chuyển trạng thái
- **WHEN** Sales ghi nhận "Lip Blush" nguồn Khách đã hỏi rồi chuyển sang Tư vấn
- **THEN** ô Nhu cầu tiếp theo hiện "Lip Blush · Tư vấn" và lịch sử nhu cầu có 2 mốc

### Requirement: Tài chính tách 3 vùng
Popup SHALL hiện tài chính thành 3 vùng riêng: Tổng tích luỹ (Giá trị DV, Thực thu, Phải thu), Đơn hiện tại (lịch gần nhất) và Lịch sử mua (từng lịch). Phải thu SHALL hiện "Chưa xác định" khi khách đã có tiền cọc mà Giá trị DV = 0.

#### Scenario: Có cọc, chưa chốt giá
- **WHEN** khách cọc 500.000 và lịch hiện tại có Giá trị DV = 0
- **THEN** Đơn hiện tại hiện "Phải thu: Chưa xác định"

### Requirement: Ảnh B/A gom theo lịch hẹn
Ảnh Trước/Sau SHALL được upload ở Drawer của lịch hẹn (không bắt buộc), lưu ở kho riêng tư, và hiện trong popup ở chế độ chỉ xem, gom theo từng lịch hẹn.

#### Scenario: Master upload ảnh
- **WHEN** Master tải 1 ảnh Trước và 1 ảnh Sau cho lịch 19/11
- **THEN** tab Ảnh B/A hiện nhóm "19/11 · 9D Brows" có 2 ảnh, và popup không có nút upload

### Requirement: Hội thoại gốc có tìm kiếm
Tab Hội thoại SHALL hiện tối đa 30 tin SMAX gần nhất của khách và có ô tìm theo nội dung. Lead-form SHALL lưu bản chụp 30 tin gần nhất vào hồ sơ khách mỗi lần Gửi/Cập nhật. Lỗi SMAX SHALL không chặn việc lưu lead.

#### Scenario: Tìm trong hội thoại
- **WHEN** user gõ "đậm" vào ô tìm
- **THEN** chỉ hiện các tin có chứa "đậm"

### Requirement: Dòng thời gian thống nhất
Tab Lịch sử & Ghi chú SHALL gộp log thay đổi lịch hẹn, ghi chú Telesales của khách, ghi chú lịch hẹn và ghi chú Sales vào một dòng thời gian (mới nhất trước), lọc được theo loại. Ghi chú nhanh từ popup SHALL lưu vào ghi chú của khách.

#### Scenario: Lọc chỉ ghi chú Sales
- **WHEN** user chọn bộ lọc "Sales"
- **THEN** dòng thời gian chỉ còn ghi chú Sales

### Requirement: Lịch nhắc chỉ hiển thị
Popup SHALL hiện các lịch nhắc đang mở của khách từ hệ thống lịch nhắc hiện có, và SHALL không có luồng tạo lịch nhắc mới.

#### Scenario: Khách có lịch nhắc 22/11
- **WHEN** khách có lịch nhắc chưa xong ngày 22/11
- **THEN** mục Việc tiếp theo hiện "22/11" kèm nội dung nhắc

### Requirement: Tab CSKH chờ phát triển
Tab CSKH SHALL hiện trạng thái "Coming soon".

#### Scenario: Mở tab CSKH
- **WHEN** user bấm tab CSKH
- **THEN** popup hiện thông báo Coming soon
