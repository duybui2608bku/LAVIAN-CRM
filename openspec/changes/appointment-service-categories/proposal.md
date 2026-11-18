## Why

Telesales nhập lịch hẹn khi chưa biết khách làm dịch vụ chi tiết nào (Shading, Ombre, Nano Lip…). Chỉ cần biết nhóm: mày, môi hay laser. Dịch vụ chi tiết do Sales/clinic điền sau.

## What Changes

- 3 **nhóm dịch vụ** cố định trong code: `alis` = Sulam Alis, `bibir` = Sulam Bibir, `laser` = Laser (tên riêng, giống nhau mọi ngôn ngữ).
- `services.category` (bắt buộc): mỗi dịch vụ hiện có trở thành **dịch vụ chi tiết** của 1 nhóm. Backfill: tên có "lip" → Bibir, "laser" → Laser, còn lại (kể cả "VIP Sulam alis + nano lip", "USA Ink", "Korea Ink") → Alis. Trang `/services` thêm cột + ô chọn Nhóm.
- `clinic_appointments.service_categories text[]` (chọn **nhiều**). Backfill lịch cũ từ nhóm của `service_ids`. Trigger log theo dõi thêm cột này.
- Form tạo lịch (`/appointments`, `/customers`) và tab lịch hẹn ở `/lead-form`: ô Dịch vụ → **Nhóm dịch vụ** (3 lựa chọn, chọn nhiều, không bắt buộc). Không chọn dịch vụ chi tiết lúc tạo nữa.
- Bảng `/appointments`: thêm cột **Nhóm dịch vụ** (sửa inline); cột Dịch vụ đổi tên **DV chi tiết**, dropdown chỉ hiện dịch vụ thuộc nhóm đã chọn (chưa chọn nhóm → hiện tất cả; dịch vụ đang gán luôn hiện).
- Drawer lịch sử lịch hẹn ở `/customers`: hiện + log Nhóm dịch vụ.
- Tour giữ nguyên (chọn 1 dịch vụ chi tiết).

## Impact

- Migration `supabase/migrations/20261118140000_service_categories.sql` — chạy **trước** khi deploy code.
- `types/service.ts`, `types/appointment.ts`, `lib/appointments.ts` (+ test), `app/(app)/appointments/{actions,page}.ts(x)`, `app/(app)/customers/actions.ts`, `app/lead-form/{actions,page}.ts(x)`, `components/appointments/appointments-manager.tsx`, `components/customers/{customers-manager,appointment-history-drawer}.tsx`, `components/lead-form/lead-form.tsx`, `components/services/services-manager.tsx`, `messages/{vi,en}.json`.
