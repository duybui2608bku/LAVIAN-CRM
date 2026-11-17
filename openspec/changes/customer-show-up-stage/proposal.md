## Why

Khách "đến phòng khám" đang gọi lẫn lộn: stage `visited` (Đã đến / Visited), Clinic confirmation "Arrived / Đã đến",
báo cáo lại gọi "Show-up". Stage còn để user chọn tay "Đã đến" dù đã có Clinic confirmation trên lịch hẹn → dữ liệu
lệch nhau. Các stage New lead / Returning / Lost không còn dùng.

## What Changes

- **Thuật ngữ thống nhất "Show-up"**: stage `visited` → `show_up` (nhãn "Show-up"), Clinic confirmation
  "Show-up / Chưa show-up" (thay Arrived / Đã đến / Visited) ở lịch hẹn, lịch sử lịch hẹn, pipeline, lead-form.
- **Stage Show-up tự động**: ẩn Show-up khỏi các ô chọn stage (bảng /customers, form khách, lead-form). Trigger DB
  `clinic_appointments_sync_show_up`: lịch được đánh dấu Show-up → khách `show_up`; bỏ Show-up (hoặc xoá mềm lịch) và khách
  không còn lịch Show-up nào → khách về `booked`.
- **Clinic confirmation chỉ bộ phận Sales** (+ admin) thao tác: UI khoá ô/switch, server action chặn.
- **Bỏ stage** `new_lead`, `returning`, `lost`. Stage không còn mặc định: form tạo khách + lead-form để trống nhưng bắt buộc chọn.
  5 khách `new_lead` hiện có → `consulting`.
- **Bỏ Lý do mất khách khỏi UI**: field trong form + module `/enums` (chỉ còn phục vụ lost_reason). Giữ cột/bảng DB.

## Migration

`20261117120000_customer_show_up_stage.sql`: đổi dữ liệu stage, bỏ default `new_lead`, check stage 4 giá trị,
trigger đồng bộ Show-up + backfill khách có lịch đã Show-up.

## Non-goals

- Không đổi tên cột `clinic_appointments.checked_in`.
- Không xoá cột `customers.lost_reason` / bảng `enum_options` (để dữ liệu cũ, dọn sau nếu cần).

## Impact

`lib/customer-options.ts`, `lib/reports.ts`, `lib/appointments.ts`, `app/(app)/{customers,appointments}/*`,
`app/lead-form/actions.ts`, `components/{customers,appointments,lead-form}/*`, xoá `app/(app)/enums`, `components/enums`,
`proxy.ts`, `types/customer.ts`, `messages/{vi,en}.json`, migration mới.
