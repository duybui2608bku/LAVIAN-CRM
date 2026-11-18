# Design: bookings-from-appointments

- **Trạng thái hiển thị** = `checked_in ? "show_up" : booking_confirm`. Ô Trạng thái sửa `booking_confirm` (quyền `appointments.edit`); lịch đã đến chỉ hiển thị (Show-up do Sales xác nhận ở trang Lịch hẹn).
- **Cần xử lý** = lịch từ hôm nay trở đi, chưa đến, `booking_confirm` ∈ {pending, rescheduled}.
- **Chưa xác nhận** = lịch hôm nay, chưa đến, pending. **Đã đến** = lịch hôm nay đã check-in.
- Ngày theo giờ máy (dayjs), giống trang Lịch hẹn.
- Deposit lấy `customers.deposit_amount` (chỉ xem). Nguồn dùng `SourceCell` (icon + số WA / IG).
- Dịch vụ: tên DV chi tiết nếu có, không thì nhóm dịch vụ.
- Sắp xếp: tab ngày / Cần xử lý theo giờ tăng dần; Tất cả: lịch mới nhất trước.
- Tái dùng `CreateAppointmentDrawer`, `AppointmentNote`, `staffOptions`, `patchAppointment`.
