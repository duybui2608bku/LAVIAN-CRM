## Why

Ở `/customers`, cột Lịch hẹn mới chỉ hiện 1 lịch gần nhất. Cần xem được toàn bộ lịch hẹn của khách và biết
ai đã đổi gì, lúc nào (ngày giờ, người, trường nào, giá trị cũ → mới).

## What Changes

- DB: bảng mới `clinic_appointment_logs` (appointment_id, customer_id, action `create|update|delete`,
  `changes` jsonb `{field: {old, new}}`, actor_id = `auth.uid()`, created_at). Ghi bằng trigger
  `AFTER INSERT OR UPDATE` trên `clinic_appointments` (security definer) — mọi đường ghi (trang `/appointments`,
  Form SMAX qua admin client) đều được log, không phải sửa từng action.
  - Trường theo dõi: `scheduled_at`, `checked_in`, `service_ids`, `staff_id`, `note`. `deleted_at` đặt giá trị → action `delete`.
  - Ghi qua admin client (Form SMAX) → `actor_id` null → UI hiện "Form SMAX".
  - RLS: chỉ đọc cho profile active; client không insert/update/delete được (chỉ trigger ghi).
  - Không backfill 12 lịch cũ (không biết ai tạo) — lịch cũ chỉ có log từ khi chạy migration.
- Server action `getCustomerAppointments(customerId)`: lịch hẹn chưa xoá + log của khách + tên dịch vụ được nhắc tới.
- `/customers` cột Lịch hẹn: thêm nút (icon lịch sử) → Drawer phải gồm 2 phần: danh sách lịch hẹn và lịch sử thay đổi
  (ngày giờ, người + avatar, hành động, từng trường `cũ → mới`).

## Impact

- `supabase/migrations/20261113090000_clinic_appointment_logs.sql` (chạy TRƯỚC khi deploy code).
- `app/(app)/customers/actions.ts`, `components/customers/{customers-manager,appointment-history-drawer}.tsx`,
  `types/appointment.ts`, `messages/{en,vi}.json`.
