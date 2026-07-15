# Delta: appointments — transition whitelist + tiền lấy từ sổ thanh toán

## ADDED Requirements

### Requirement: Transition trạng thái theo whitelist và hoàn tác
Server action đổi trạng thái SHALL chỉ chấp nhận transition trong whitelist: `pending_confirmation → booked|cancelled`; `booked → checked_in|no_show|cancelled`; `checked_in → completed|booked|cancelled`; `completed → checked_in`; `no_show → booked`; `cancelled → booked`. Transition ngoài whitelist SHALL bị từ chối kèm thông báo lỗi. Hoàn tác (`checked_in → booked`, `completed → checked_in`, `cancelled/no_show → booked`) SHALL xóa timestamp mốc của trạng thái vừa rời. Mọi lần đổi vẫn được trigger ghi vào `appointment_status_history`.

#### Scenario: Bấm nhầm đã đến
- **WHEN** người dùng bấm hoàn tác trên lịch `checked_in`
- **THEN** status quay về `booked`, `checked_in_at` bị xóa, history ghi dòng checked_in → booked

#### Scenario: Bấm nhầm hoàn tất
- **WHEN** người dùng bấm hoàn tác trên lịch `completed`
- **THEN** status quay về `checked_in`, `completed_at` bị xóa; các dòng sổ thanh toán đã ghi giữ nguyên (tự xóa trong dialog Thanh toán nếu ghi nhầm)

#### Scenario: Khách đến nhưng không làm dịch vụ
- **WHEN** người dùng hủy một lịch đang `checked_in`
- **THEN** status → `cancelled`, `checked_in_at` giữ nguyên — thống kê phân biệt "đến không làm" (cancelled có `checked_in_at`) với hủy trước hẹn

#### Scenario: Transition không hợp lệ bị chặn
- **WHEN** gửi yêu cầu chuyển `completed → booked`
- **THEN** server trả lỗi, status và history không đổi

## MODIFIED Requirements

### Requirement: Lưu trữ lịch hẹn
Hệ thống SHALL lưu lịch hẹn trong bảng `public.appointments` với: khách hàng (FK cascade), nhân viên (FK set null), thời điểm hẹn `scheduled_at` (nullable), thời lượng, trạng thái (`pending_confirmation|booked|checked_in|completed|no_show|cancelled` — check constraint, KHÔNG dùng enum_options), nguồn, số tiền nội bộ (`expected_amount` báo giá, `final_amount` doanh số chốt của lần hẹn, `payment_method`), ghi chú (`booking_note`, `internal_note`), timestamp mốc trạng thái, soft-delete `deleted_at`. Nhiều dịch vụ mỗi lịch qua bảng nối `appointment_services`. Tiền đã thu KHÔNG lưu cột tĩnh — lấy từ sổ `appointment_payments` (capability appointment-payments).

#### Scenario: Tạo lịch hẹn có ngày giờ
- **WHEN** người dùng tạo lịch hẹn với khách, dịch vụ, ngày giờ
- **THEN** dòng `appointments` status `booked` được tạo kèm các dòng `appointment_services`

#### Scenario: Cọc chưa chốt ngày (thay sheet DP CUS)
- **WHEN** khách đã chuyển cọc nhưng chưa báo ngày
- **THEN** tạo được lịch hẹn `scheduled_at = null`, status `pending_confirmation`, sổ thanh toán có dòng `deposit`

### Requirement: Màn hình vận hành /appointments
Hệ thống SHALL có trang `/appointments` cho mọi user đã đăng nhập: danh sách theo ngày (mặc định hôm nay), nhóm theo trạng thái, lọc (ngày, trạng thái, nhân viên, dịch vụ), tab "Chờ xếp lịch" (`scheduled_at is null`), action nhanh theo whitelist transition (check-in, hoàn tất kèm nhập doanh số + tiền thu + ảnh, no-show, hủy, dời lịch, hoàn tác, mở dialog Thanh toán), cột tiền Báo giá / Đã thu / Doanh số / Còn nợ, dòng tổng `final_amount` các lịch `completed` trong ngày, dialog tạo/sửa lịch hẹn (tạo mới nhập được Cọc + ảnh; sửa hiện Đã thu read-only + nút mở dialog Thanh toán).

#### Scenario: Xem lịch trong ngày
- **WHEN** mở `/appointments`
- **THEN** thấy các lịch có `scheduled_at` trong hôm nay, nhóm theo trạng thái, cột Đã thu/Còn nợ tính từ sổ, kèm tổng doanh thu ngày

#### Scenario: Check-in nhanh
- **WHEN** bấm check-in trên một lịch `booked`
- **THEN** status → `checked_in`, `checked_in_at` được stamp, toast xác nhận

#### Scenario: Tab chờ xếp lịch
- **WHEN** mở tab "Chờ xếp lịch"
- **THEN** thấy các lịch `scheduled_at is null` chưa hủy, kèm Đã thu (cọc) và ghi chú
