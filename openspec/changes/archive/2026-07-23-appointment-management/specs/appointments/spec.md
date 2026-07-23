# Spec: appointments

## ADDED Requirements

### Requirement: Lưu trữ lịch hẹn
Hệ thống SHALL lưu lịch hẹn trong bảng `public.appointments` với: khách hàng (FK cascade), nhân viên (FK set null), thời điểm hẹn `scheduled_at` (nullable), thời lượng, trạng thái (`pending_confirmation|booked|checked_in|completed|no_show|cancelled` — check constraint, KHÔNG dùng enum_options), nguồn, số tiền nội bộ (`deposit_amount`, `expected_amount`, `final_amount`, `payment_method`), ghi chú (`booking_note`, `internal_note`), timestamp mốc trạng thái, soft-delete `deleted_at`. Nhiều dịch vụ mỗi lịch qua bảng nối `appointment_services`.

#### Scenario: Tạo lịch hẹn có ngày giờ
- **WHEN** người dùng tạo lịch hẹn với khách, dịch vụ, ngày giờ
- **THEN** dòng `appointments` status `booked` được tạo kèm các dòng `appointment_services`

#### Scenario: Cọc chưa chốt ngày (thay sheet DP CUS)
- **WHEN** khách đã chuyển cọc nhưng chưa báo ngày
- **THEN** tạo được lịch hẹn `scheduled_at = null`, status `pending_confirmation`, có `deposit_amount`

### Requirement: Lịch sử trạng thái tự động
Hệ thống SHALL tự ghi một dòng `appointment_status_history` (from/to, người đổi, thời điểm) bằng trigger DB mỗi khi `appointments.status` đổi. History là bất biến (chỉ grant select, insert).

#### Scenario: Đổi trạng thái
- **WHEN** status đổi từ `booked` sang `checked_in`
- **THEN** history có dòng mới from=`booked`, to=`checked_in`, `changed_by = auth.uid()`

#### Scenario: Dời lịch không phải trạng thái
- **WHEN** người dùng dời `scheduled_at` của lịch `booked`
- **THEN** status giữ `booked`, không có dòng history status mới

### Requirement: Màn hình vận hành /appointments
Hệ thống SHALL có trang `/appointments` cho mọi user đã đăng nhập: danh sách theo ngày (mặc định hôm nay), nhóm theo trạng thái, lọc (ngày, trạng thái, nhân viên, dịch vụ), tab "Chờ xếp lịch" (`scheduled_at is null`), action nhanh chuyển trạng thái (check-in, hoàn tất kèm nhập `final_amount`, no-show, hủy, dời lịch), dòng tổng `final_amount` các lịch `completed` trong ngày, dialog tạo/sửa lịch hẹn.

#### Scenario: Xem lịch trong ngày
- **WHEN** mở `/appointments`
- **THEN** thấy các lịch có `scheduled_at` trong hôm nay, nhóm theo trạng thái, kèm tổng doanh thu ngày

#### Scenario: Check-in nhanh
- **WHEN** bấm check-in trên một lịch `booked`
- **THEN** status → `checked_in`, `checked_in_at` được stamp, toast xác nhận

#### Scenario: Tab chờ xếp lịch
- **WHEN** mở tab "Chờ xếp lịch"
- **THEN** thấy các lịch `scheduled_at is null` chưa hủy, kèm cọc và ghi chú

### Requirement: Đồng bộ stage khách hàng chỉ đi tiến
Khi tạo lịch/cọc/check-in/hoàn tất, hệ thống SHALL nâng `customer.stage` tương ứng (`booked`/`deposited`/`visited`) CHỈ KHI stage mới có `sort_order` cao hơn stage hiện tại.

#### Scenario: Khách cũ đặt lịch mới
- **WHEN** khách stage `returning` có lịch hẹn mới
- **THEN** stage giữ nguyên `returning` (không tụt về `booked`)

### Requirement: Đặt lịch từ /customers
Trang `/customers` SHALL có action mở dialog tạo lịch hẹn cho khách đó và xem danh sách lịch hẹn của khách (mới nhất trước).

#### Scenario: Đặt lịch cho khách
- **WHEN** bấm "Đặt lịch" trên một dòng khách
- **THEN** dialog tạo lịch mở sẵn với khách đó; lưu xong lịch xuất hiện ở /appointments
