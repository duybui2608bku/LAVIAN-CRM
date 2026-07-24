## ADDED Requirements

### Requirement: Bố cục lịch hẹn 1/2 hàng kèm biểu đồ xu hướng
Trang báo cáo SHALL đặt section "Lịch hẹn" và section "Xu hướng 7 ngày" cạnh nhau, mỗi section chiếm 1/2 hàng trên màn hình rộng (`xl`) và xếp chồng trên màn hình hẹp. 3 card lịch hẹn SHALL giữ nguyên số liệu (số lượng, tăng trưởng, đặt cọc / chưa cọc) ở dạng nén để vừa nửa hàng.

#### Scenario: Màn hình rộng
- **WHEN** xem trang báo cáo ở bề rộng ≥ `xl`
- **THEN** section lịch hẹn nằm nửa trái, biểu đồ 7 ngày nằm nửa phải trên cùng một hàng

#### Scenario: Màn hình hẹp
- **WHEN** xem trên màn hình nhỏ hơn `xl`
- **THEN** 2 section xếp dọc, 3 card lịch hẹn không bị tràn ngang

### Requirement: Biểu đồ cột 7 ngày
Trang báo cáo SHALL hiển thị biểu đồ cột nhóm cho 7 ngày gần nhất (kết thúc ở ngày `to` của bộ lọc ngày) với 3 series: **Data**, **Lịch hẹn**, **Khách đến** — số liệu lấy từ `GET /api/appointments/trend`. Biểu đồ SHALL có legend nhãn chữ cho từng series và mỗi cột SHALL kèm nhãn văn bản (tooltip/`aria-label`) gồm tên series, ngày và giá trị — không phân biệt series chỉ bằng màu.

#### Scenario: Đổi bộ lọc ngày
- **WHEN** người dùng chọn khoảng ngày kết thúc ở 2026-06-30
- **THEN** biểu đồ hiển thị 7 ngày từ 2026-06-24 đến 2026-06-30

#### Scenario: Đang tải và lỗi
- **WHEN** API xu hướng chưa trả về
- **THEN** khu vực biểu đồ hiện trạng thái đang tải; khi API lỗi thì hiện thông báo lỗi thay vì biểu đồ rỗng
