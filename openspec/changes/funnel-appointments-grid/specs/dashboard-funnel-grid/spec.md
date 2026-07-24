## ADDED Requirements

### Requirement: Grid phễu công việc trên trang báo cáo
Section "Khách hàng" trên `/` SHALL render dạng pipeline 4 bước nối mũi tên — Khách nhắn tin → Khách hàng để lại SĐT → Lịch hẹn → Đã đến — lấy số từ `GET /api/customers/funnel` theo khoảng ngày đang chọn (không có WhatsApp). Mỗi card SHALL hiển thị: count, % so bước đầu (Khách nhắn tin), badge tăng trưởng so kỳ trước. Dưới pipeline SHALL có dòng tổng chuyển đổi Khách nhắn tin → Đã đến (`visited / messages`). Nguồn nào lỗi (`errors.smax` / `errors.db`) thì card nguồn đó hiển thị "—" kèm thông báo lỗi, nguồn còn lại vẫn có số.

#### Scenario: Pipeline hiển thị đủ 4 bước
- **WHEN** API trả messages=1256, leads=856, appointments=256, visited=198
- **THEN** 4 card hiện count kèm % lần lượt 100% / 68,2% / 20,4% / 15,8% và dòng tổng chuyển đổi 15,8%

#### Scenario: SMAX lỗi không làm hỏng card DB
- **WHEN** API trả `errors.smax` có message, `appointments`/`visited` có số
- **THEN** 2 card đầu hiện "—" + message lỗi, 2 card sau vẫn hiện count và growth

### Requirement: Ba card lịch hẹn từ API thống kê
Section "Lịch hẹn" trên `/` SHALL render đúng 3 card từ `GET /api/appointments/summary` theo khoảng ngày đang chọn — Lịch hẹn trong ngày (`newCustomer`), Lịch hẹn ngày đang chọn (`selected`), Lịch hẹn ngày mai (`tomorrow`) — KHÔNG có card "Tổng lịch hẹn". Mỗi card SHALL hiển thị count, badge tăng trưởng và breakdown Có đặt cọc / Chưa đặt cọc. Card ngày mai SHALL dùng nhãn so sánh "so với hôm nay"; hai card kia "so với kỳ trước".

#### Scenario: Card đủ số liệu
- **WHEN** API trả `selected = { count: 42, growthPercent: -5.1, deposited: 18, notDeposited: 24 }`
- **THEN** card hiện 42, badge −5,1% "so với kỳ trước", Có đặt cọc 18 / Chưa đặt cọc 24

### Requirement: Label linh hoạt theo ngày chọn
Card `selected` SHALL đổi label theo `period` API trả về: khoảng chọn đúng hôm nay VN → "Lịch hẹn hôm nay"; một ngày khác → "Lịch hẹn dd/MM"; một khoảng → "Lịch hẹn dd/MM – dd/MM". Card ngày mai SHALL luôn là "Lịch hẹn ngày mai" bất kể bộ lọc.

#### Scenario: Chọn ngày khác hôm nay
- **WHEN** hôm nay VN là 24/07 và user chọn 25/09
- **THEN** card selected hiện label "Lịch hẹn 25/09", card tomorrow vẫn "Lịch hẹn ngày mai" với số của 25/07
