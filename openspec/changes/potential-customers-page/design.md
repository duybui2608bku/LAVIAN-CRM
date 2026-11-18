# Design: potential-customers-page

## Dữ liệu (cột mới trên `customers`, không bảng mới)

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `potential_status` | text check (`interested`, `considering`, `no_response`, `converted`) | Tình trạng khách tiềm năng |
| `follow_up_at` | timestamptz | Ngày giờ liên hệ lại |
| `converted_at` | timestamptz | Lúc chuyển đổi sang Booking từ trang tiềm năng (card "Chuyển đổi booking hôm nay") |

- Check `customers_stage_check` thêm `consider`.
- Index một phần `(follow_up_at) where follow_up_at is not null and deleted_at is null` cho cron.

**Vì sao không dùng lại `customer_reminders`:** mỗi khách tiềm năng chỉ có 1 ngày liên hệ lại, sửa thẳng trên bảng; 1 cột đơn giản hơn nhiều so với quản lý danh sách lịch nhắc. Phần "kế thừa" là hạ tầng thông báo (`notifications`, realtime, chuông).

## Thông báo

- `notify_follow_ups_due()` (security definer, revoke execute) — cron `follow-up-due` `*/5 * * * *`:
  khách `stage = potential`, chưa xoá, `follow_up_at` trong (now − 1 ngày, now], Telesales active →
  insert `kind = 'follow_up_due'`, `data = {customer_id, customer, follow_up_at}`, link `/customers/potential`.
  **Chống trùng** bằng `not exists` trên `notifications` cùng `customer_id` + `follow_up_at` — không cần cột "đã báo" (tránh update `customers` làm nhảy `updated_at`). Dời hẹn → `follow_up_at` mới → báo lại.
- `notify_daily_follow_ups()` — cron `daily-follow-up-digest` `0 1 * * *` (8:00 VN): gom theo Telesales, `kind = 'follow_up_digest'`, `data = {today, overdue}`.
- Người nhận giống lịch nhắc: `customers.staff_id`, active, bộ phận telesales/telesales_leader.

## Chuyển đổi đặt lịch

Inline select Tình trạng chọn `converted` → không lưu ngay mà mở `CreateAppointmentDrawer` (có sẵn). `onCreated` → server action `convertPotentialCustomer(id)`: `stage = 'booked'`, `potential_status = 'converted'`, `converted_at = now()`, `follow_up_at = null`. Huỷ drawer → không đổi gì.
(Tạo lịch hẹn cho khách có sẵn không tự đổi stage — chỉ khách tạo nhanh mới vào Booking — nên cần action này.)

## UI

- Server page tải: khách `stage = potential` (cùng field list trang Khách hàng + 3 cột mới), staff, số khách `converted_at` hôm nay (giờ VN).
- `potential-manager.tsx` (client): `StatCard` ×4, `PageToolbar` (Input tìm, ClearableSelect Tele, ClearableSelect Tình trạng), `Segmented` 4 tab, `DataTable`.
- Trạng thái hẹn dùng lại `reminderState` + `REMINDER_COLORS` (quá hạn = trước bây giờ; hôm nay = sau bây giờ trong ngày; sắp tới).
- Ô Ngày giờ liên hệ lại: `AppointmentDate inline` (chọn ngày + giờ, xác nhận mới lưu).
- Modal ghi chú: export `NotesModal` từ `customers-manager.tsx`; ô Nguồn: export `SourceCell`.
- Sắp xếp mặc định theo `follow_up_at` tăng dần (chưa đặt hẹn xuống cuối).

## Rủi ro

- Cron 5 phút = ~288 lần chạy/ngày, mỗi lần quét qua index một phần → nhẹ.
- Thông báo kiểu mới cần chữ ở chuông (`follow_up_due`, `follow_up_digest`); kiểu lạ vẫn hiện `kind` thô.
