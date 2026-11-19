# Proposal: appointment-visit-status

## Why

Theo mẫu "Sales Management" của sếp, cột Clinic confirmation chỉ có 2 giá trị (Đã đến / Chưa đến) không đủ theo dõi khách tại phòng khám. Sales cần biết khách đang được làm, đã làm xong hay phải đổi lịch. Telesales cũng cần thấy trạng thái này ngay trên trang Khách hàng / Khách tiềm năng mà không phải mở trang Lịch hẹn.

## What Changes

- **DB (migration `20261119120000_appointment_visit_status.sql`):**
  - Cột `clinic_appointments.visit_status text not null default 'waiting'`, check ∈ `waiting | arrived | in_progress | done | rescheduled`. Backfill: `checked_in = true` → `arrived`.
  - Trigger BEFORE `clinic_appointments_sync_checked_in` giữ `checked_in` khớp với `visit_status` (`arrived`/`in_progress`/`done` = đã đến). Đường cũ chỉ ghi `checked_in` (vd lead form) vẫn được map ngược sang `visit_status`. Báo cáo / API / pipeline đang đọc `checked_in` không phải sửa.
  - Tạo lại trigger `clinic_appointments_sync_show_up` để bắt cả `UPDATE OF visit_status`. Postgres không tính cột do trigger BEFORE đổi, nên nếu không làm thì đổi trạng thái sẽ không tự chuyển stage Show-up.
  - Trigger log theo dõi `visit_status` thay cho `checked_in` (log cũ vẫn hiển thị).
- **`/appointments`:** cột "Clinic confirmation" đổi tên thành **Status** (vi: Trạng thái), chọn 1 trong 5: Chưa đến, Đã đến, Đang thực hiện, Đã thực hiện, Đổi lịch. Vẫn chỉ Sales + admin đổi được. Bộ lọc trên toolbar lọc theo 5 trạng thái.
- **`/customers` và `/customers/potential`:** cột **Sales Status** (chỉ xem) ngay sau cột Stage / Status, hiện trạng thái của lịch hẹn gần nhất của khách (cùng lịch với cột Lịch hẹn); không có lịch thì hiện "—".
- **Server:** `appointmentPatchSchema` thay `checked_in` bằng `visit_status`. Quyền Sales giữ nguyên.

## Impact

- `supabase/migrations/20261119120000_appointment_visit_status.sql` (mới): **chạy trước khi deploy**.
- `types/appointment.ts`, `lib/appointments.ts` (+test), `app/(app)/appointments/{actions.ts,page.tsx}`
- `components/appointments/appointments-manager.tsx`, `components/customers/{customers-manager.tsx,potential-manager.tsx,customer-pipeline.tsx,appointment-history-drawer.tsx}`
- `app/(app)/customers/{customers-view.tsx,potential/page.tsx}`, `messages/{vi,en}.json`
- Ghi chú BA: "Đổi lịch" ở Status trùng nghĩa với "Đổi lịch" ở cột Xác nhận lịch (`booking_confirm`). Hai cột hiện vẫn độc lập, chưa tự đồng bộ.
