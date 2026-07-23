# Tasks: appointment-management

## 1. Database

- [x] 1.1 Migration `supabase/migrations/20260710130000_appointments.sql`: bảng `appointments` + `appointment_services` + `appointment_status_history`, check constraint status, index partial theo design, trigger `set_updated_at` reuse, trigger ghi history khi status đổi, RLS + grant (history chỉ select/insert), idempotent

## 2. Types & helpers

- [x] 2.1 `types/appointment.ts`: `APPOINTMENT_STATUSES` const, `Appointment`, `AppointmentInput`, `AppointmentStatus`
- [x] 2.2 `lib/appointments.ts`: helper thuần (lọc client-side, `outstanding`, nhóm theo trạng thái) + test node

## 3. Server actions & page

- [x] 3.1 `app/(app)/appointments/actions.ts`: `createAppointment`, `updateAppointment`, `setAppointmentStatus` (stamp mốc thời gian, hoàn tất kèm final_amount), `rescheduleAppointment`, `deleteAppointment` (soft), helper `syncServices` (copy pattern customers) + nâng stage khách chỉ-đi-tiến
- [x] 3.2 `app/(app)/appointments/page.tsx`: query appointments (nested select services) + staff + enum_options + services + customers (tên)

## 4. UI

- [x] 4.1 `components/appointments/appointments-manager.tsx`: lọc ngày (DatePicker) + trạng thái/nhân viên/dịch vụ, bảng nhóm theo trạng thái, action nhanh check-in/hoàn tất/no-show/hủy/dời lịch, tab "Chờ xếp lịch", dòng tổng doanh thu ngày, dialog tạo/sửa (MultiSelect dịch vụ, DatePicker + giờ)
- [x] 4.2 Sidebar: mục "Lịch hẹn" (mọi user); i18n `nav.appointments` + namespace `appointments` (vi/en/id)
- [x] 4.3 `/customers`: nút "Đặt lịch" mỗi dòng mở dialog tạo lịch + dialog lịch sử lịch hẹn của khách

## 5. Verify

- [x] 5.1 `node --test lib/appointments.test.ts` PASS; `tsc --noEmit` sạch; `next build` PASS; cập nhật memory-bank
