# Delta: appointments — calendar view tuần/tháng

## ADDED Requirements

### Requirement: Chuyển đổi giữa bảng và calendar view
Trang `/appointments` SHALL có toggle chế độ xem giữa bảng (mặc định, giữ nguyên hành vi hiện tại) và calendar; khi ở chế độ calendar, người dùng SHALL chọn được kiểu Tuần hoặc Tháng.

#### Scenario: Bật calendar view
- **WHEN** người dùng bấm icon calendar trên trang lịch hẹn
- **THEN** bảng được thay bằng lưới calendar (Tuần mặc định), tab Trong ngày/Chờ xếp lịch và bộ lọc ngày/trạng thái ẩn đi; bộ lọc tìm kiếm, nhân viên, dịch vụ vẫn áp dụng

#### Scenario: Quay lại bảng
- **WHEN** người dùng bấm icon bảng
- **THEN** giao diện bảng hiện lại đúng trạng thái tab/ngày trước đó

### Requirement: Calendar tuần
Kiểu Tuần SHALL hiển thị lưới giờ × 7 ngày (Thứ 2 → Chủ nhật); mỗi lịch hẹn có `scheduled_at` trong tuần hiển thị thành card đặt theo giờ bắt đầu, cao theo thời lượng, tô màu theo trạng thái; các lịch chồng giờ trong cùng ngày SHALL chia cột con để không đè nhau.

#### Scenario: Card đúng vị trí giờ
- **WHEN** một lịch hẹn 10:00 thời lượng 60 phút nằm trong tuần đang xem
- **THEN** card hiện ở cột ngày tương ứng, mép trên tại mốc 10:00, chiều cao tương ứng 60 phút, nền màu trạng thái, hiện giờ + tên khách

#### Scenario: Hai lịch chồng giờ
- **WHEN** hai lịch cùng ngày có khoảng giờ giao nhau
- **THEN** hai card chia đôi bề rộng cột ngày, không đè lên nhau

### Requirement: Calendar tháng
Kiểu Tháng SHALL hiển thị lưới ngày phủ đủ tháng đang xem; mỗi ô ngày liệt kê tối đa 3 chip lịch hẹn (giờ + tên khách, màu trạng thái) và dòng "+n" khi dư; bấm số ngày hoặc "+n" SHALL chuyển về bảng của đúng ngày đó.

#### Scenario: Ngày có nhiều hơn 3 lịch
- **WHEN** một ngày có 5 lịch hẹn
- **THEN** ô ngày hiện 3 chip đầu (theo giờ tăng dần) + dòng "+2"

#### Scenario: Xem chi tiết một ngày
- **WHEN** người dùng bấm "+n" hoặc số ngày trong ô
- **THEN** trang chuyển về chế độ bảng với bộ lọc ngày đặt đúng ngày đó

### Requirement: Điều hướng calendar
Chế độ calendar SHALL có nút Trước / Hôm nay / Sau để dịch chuyển tuần hoặc tháng đang xem, kèm nhãn khoảng thời gian hiện tại; ngày hôm nay SHALL được làm nổi trong lưới.

#### Scenario: Dịch tuần
- **WHEN** đang xem kiểu Tuần và bấm nút Sau
- **THEN** lưới hiển thị tuần kế tiếp, nhãn khoảng ngày cập nhật

#### Scenario: Về hôm nay
- **WHEN** bấm nút Hôm nay
- **THEN** lưới nhảy về tuần/tháng chứa ngày hiện tại, ô hôm nay được highlight

### Requirement: Mở dialog sửa từ calendar
Bấm card/chip lịch hẹn trên calendar SHALL mở dialog sửa lịch hẹn sẵn có với đúng dữ liệu lịch đó.

#### Scenario: Sửa từ card tuần
- **WHEN** người dùng bấm một card trên lưới tuần
- **THEN** `AppointmentDialog` mở ở chế độ sửa lịch hẹn đó; lưu xong dữ liệu calendar cập nhật
