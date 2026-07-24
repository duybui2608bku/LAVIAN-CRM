# service-stats-api — Delta Spec

## ADDED Requirements

### Requirement: API thống kê theo từng dịch vụ
Hệ thống SHALL cung cấp `GET /api/services/stats?from=YYYY-MM-DD&to=YYYY-MM-DD` (gác admin) trả về, với **mỗi dịch vụ** trong bảng `services` (kể cả dịch vụ đã tắt), các chỉ số trong kỳ (quy đổi giờ VN qua `supaRange`):
- `data`: số khách `deleted_at is null`, `created_at` trong kỳ, có dòng `customer_services` trỏ dịch vụ đó;
- `booked`: số lượt lịch hẹn `deleted_at is null`, `scheduled_at` trong kỳ, có dòng `appointment_services` trỏ dịch vụ đó (không lọc theo status);
- `arrived`: số lượt trong `booked` có `checked_in_at is not null`;
- `baseRevenue`: Σ `total_amount` của sổ `service_ledgers` đã báo giá (`total_amount` not null), `service_id` = dịch vụ đó, `created_at` trong kỳ;
- `upsalesRevenue`: Σ `amount` của `appointment_upsales` có `service_id` = dịch vụ đó, `created_at` trong kỳ;
- `revenue` = `baseRevenue + upsalesRevenue`;
- `orderCount`: số sổ đã báo giá + số record upsale nói trên; `aov` = `revenue / orderCount` (0 khi `orderCount = 0`).

#### Scenario: Trả số liệu đúng theo kỳ
- **WHEN** admin gọi `GET /api/services/stats?from=2026-07-01&to=2026-07-24` và dịch vụ "Triệt lông" có 10 khách mới gắn dịch vụ, 6 lịch hẹn trong kỳ (4 lịch đã check-in), 3 sổ báo giá tổng 30.000.000 và 1 upsale 6.000.000
- **THEN** dòng của dịch vụ đó trả `data=10`, `booked=6`, `arrived=4`, `baseRevenue=30000000`, `upsalesRevenue=6000000`, `revenue=36000000`, `orderCount=4`, `aov=9000000`

#### Scenario: Doanh thu luôn gồm upsales
- **WHEN** một dịch vụ trong kỳ không có sổ nào nhưng có 2 upsale tổng 5.000.000
- **THEN** dịch vụ đó trả `baseRevenue=0`, `upsalesRevenue=5000000`, `revenue=5000000`, `orderCount=2`, `aov=2500000`

#### Scenario: Upsale tính cho dịch vụ được bán thêm
- **WHEN** lịch hẹn của dịch vụ A phát sinh upsale dịch vụ B
- **THEN** số tiền upsale đó vào `upsalesRevenue` của **B**, không vào của A

#### Scenario: Khách đến tính cả ca đến rồi hủy
- **WHEN** một lịch trong kỳ có `checked_in_at` not null nhưng `status = 'cancelled'` (khách đến nhưng không làm)
- **THEN** lịch đó vẫn được đếm vào `arrived`

#### Scenario: Sổ chưa báo giá không tính doanh thu
- **WHEN** sổ `service_ledgers` của dịch vụ có `total_amount` null
- **THEN** sổ đó không đóng góp vào `baseRevenue` và không được đếm vào `orderCount`

#### Scenario: Dịch vụ không phát sinh gì vẫn có dòng
- **WHEN** một dịch vụ không có data/lịch/sổ/upsale nào trong kỳ
- **THEN** vẫn trả dòng của dịch vụ đó với mọi chỉ số bằng 0 (không chia 0)

#### Scenario: Chặn không phải admin
- **WHEN** request không có session admin
- **THEN** trả lỗi `{ error: { code, message } }` với status 401/403, không lộ số liệu

#### Scenario: Khoảng ngày không hợp lệ
- **WHEN** `from`/`to` thiếu, sai định dạng, hoặc `from > to`
- **THEN** trả 400 `INVALID_DATE_RANGE`

#### Scenario: Không dính trần 1.000 row
- **WHEN** kỳ có hơn 1.000 lịch hẹn, khách, sổ hoặc upsale
- **THEN** API vẫn đếm/cộng đủ (query phân trang theo pattern `/api/finance/revenue`)

### Requirement: Bảng "Hiệu quả dịch vụ" trên trang báo cáo
Trang báo cáo `/` SHALL hiển thị bảng "Hiệu quả dịch vụ" chiếm **nửa hàng** (cùng grid `xl:grid-cols-2` với bảng nhân viên và bảng sales), lấy dữ liệu từ `GET /api/services/stats` theo đúng khoảng ngày đang chọn, với các cột Dịch vụ / Data / Chốt lịch / Khách đến / Doanh thu / Trung bình đơn và một dòng Tổng.

#### Scenario: Đổi khoảng ngày
- **WHEN** người dùng đổi bộ lọc ngày trên trang báo cáo
- **THEN** bảng dịch vụ gọi lại API cùng `from`/`to` với các bảng/card khác và mờ đi trong lúc tải

#### Scenario: Ẩn dịch vụ không phát sinh
- **WHEN** API trả về dịch vụ có `data = 0`, `booked = 0` và `orderCount = 0`
- **THEN** bảng không hiện dòng đó; nếu không còn dòng nào thì hiện dòng trống "Không có dữ liệu dịch vụ"

#### Scenario: Dòng Tổng
- **WHEN** bảng có ít nhất 1 dòng
- **THEN** dòng Tổng cộng dồn Data/Chốt lịch/Khách đến/Doanh thu và tính Trung bình đơn = tổng doanh thu / tổng `orderCount` (không cộng trung bình của các dòng)

#### Scenario: Lỗi API không phá trang
- **WHEN** `/api/services/stats` lỗi (vd. user không phải admin)
- **THEN** chỉ khu vực bảng dịch vụ hiện thông báo lỗi, các card/bảng khác vẫn hiển thị bình thường
