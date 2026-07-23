# Delta: appointments — dịch vụ bắt buộc (1/lịch), tag Khách cũ, tiền tra qua sổ

## ADDED Requirements

### Requirement: Bắt buộc đúng một dịch vụ mỗi lịch hẹn
Form tạo/sửa lịch hẹn SHALL dùng select đơn bắt buộc cho dịch vụ (thay multi-select); server action SHALL từ chối tạo/sửa khi số dịch vụ gửi lên khác 1. Schema bảng nối `appointment_services` giữ nguyên — lịch cũ nhiều dịch vụ vẫn hiển thị được, khi sửa phải chọn lại đúng 1.

#### Scenario: Tạo lịch không chọn dịch vụ bị chặn
- **WHEN** người dùng submit form tạo lịch hẹn chưa chọn dịch vụ
- **THEN** form báo lỗi bắt buộc; nếu gọi thẳng server action cũng bị từ chối kèm thông báo

#### Scenario: Sửa lịch cũ có nhiều dịch vụ
- **WHEN** người dùng mở sửa một lịch cũ gắn 2 dịch vụ và lưu
- **THEN** select hiện dịch vụ đầu tiên, sau khi lưu lịch chỉ còn đúng 1 dịch vụ đã chọn

### Requirement: Tag Khách cũ
Hệ thống SHALL đánh dấu "Khách cũ" (suy ra từ dữ liệu, không thêm cột DB) khi khách đã có lịch hẹn khác (chưa xóa) tạo trước đó: badge cạnh tên khách ở bảng `/appointments` và cạnh ô chọn khách trong drawer đặt lịch khi khách được chọn đã có lịch hẹn.

#### Scenario: Đặt lịch cho khách đã từng hẹn
- **WHEN** người dùng chọn khách đã có lịch hẹn trước đó trong drawer đặt lịch
- **THEN** badge "Khách cũ" hiện cạnh ô chọn khách

#### Scenario: Khách lần đầu không có tag
- **WHEN** xem bảng `/appointments` với lịch hẹn ĐẦU TIÊN của một khách
- **THEN** dòng đó không có badge "Khách cũ"; các lịch tạo sau của cùng khách thì có

## MODIFIED Requirements

### Requirement: Lưu trữ lịch hẹn
Hệ thống SHALL lưu lịch hẹn trong bảng `public.appointments` với: khách hàng (FK cascade), nhân viên (FK set null), thời điểm hẹn `scheduled_at` (nullable), thời lượng, trạng thái (`pending_confirmation|booked|checked_in|completed|no_show|cancelled` — check constraint, KHÔNG dùng enum_options), nguồn, `payment_method`, **`ledger_id` FK sổ tiền `service_ledgers` (on delete set null)**, ghi chú (`booking_note`, `internal_note`), timestamp mốc trạng thái, soft-delete `deleted_at`. Các cột tiền per lịch (`expected_amount`, `final_amount`) bị loại bỏ — tổng giá và tiền đã thu tra qua sổ (capability appointment-payments). Dịch vụ qua bảng nối `appointment_services`, ràng buộc đúng 1 ở tầng app.

#### Scenario: Tạo lịch hẹn có ngày giờ
- **WHEN** người dùng tạo lịch hẹn với khách, 1 dịch vụ, ngày giờ
- **THEN** dòng `appointments` status `booked` được tạo, gắn `ledger_id` sổ mở của (khách, dịch vụ) và 1 dòng `appointment_services`

#### Scenario: Cọc chưa chốt ngày (thay sheet DP CUS)
- **WHEN** khách đã chuyển cọc nhưng chưa báo ngày
- **THEN** tạo được lịch hẹn `scheduled_at = null`, status `pending_confirmation`, sổ của (khách, dịch vụ) có dòng `deposit`

### Requirement: Màn hình vận hành /appointments
Hệ thống SHALL có trang `/appointments` cho mọi user đã đăng nhập: danh sách theo ngày (mặc định hôm nay), nhóm theo trạng thái, lọc (ngày, trạng thái, nhân viên, dịch vụ), tab "Chờ xếp lịch" (`scheduled_at is null`), action nhanh theo whitelist transition (check-in, hoàn tất kèm nhập tổng giá + tiền thu + ảnh, no-show, hủy, dời lịch, hoàn tác, mở dialog Thanh toán), cột tiền Tổng giá / Đã thu / Còn nợ lấy theo sổ, badge "Khách cũ", dialog tạo/sửa lịch hẹn (tạo mới nhập được Cọc; sửa hiện Đã thu read-only + nút mở dialog Thanh toán). Trang KHÔNG còn dòng tổng doanh thu ngày (báo cáo doanh thu thuộc menu thống kê riêng, ngoài phạm vi).

#### Scenario: Xem lịch trong ngày
- **WHEN** mở `/appointments`
- **THEN** thấy các lịch có `scheduled_at` trong hôm nay, nhóm theo trạng thái, cột Tổng giá/Đã thu/Còn nợ theo sổ, không có dòng tổng doanh thu

#### Scenario: Hai lịch chung sổ hiện cùng số tiền
- **WHEN** trong ngày có 2 lịch của cùng khách + cùng dịch vụ (chung sổ)
- **THEN** cả 2 dòng hiện cùng Tổng giá/Đã thu/Còn nợ của sổ đó
