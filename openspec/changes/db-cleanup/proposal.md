## Why

Sau nhiều vòng đổi nghiệp vụ (lịch hẹn cũ + sổ tiền liệu trình → `clinic_appointments` + `tours`;
dịch vụ gắn khách → chỉ chọn trên lịch hẹn; stage/source chuyển sang hằng số code), DB còn sót
bảng, trigger, function, policy, index và dữ liệu danh mục không còn code nào dùng. Chúng làm rối schema,
sinh cảnh báo advisor và nhân chi phí RLS. Một số query cũng kéo cột jsonb lớn rồi bỏ ở server.

Khảo sát DB thật (project `Lavian`, 2026-11-12): 8 bảng cũ đều **0 dòng**, không file nào trong
`app/ lib/ components/ types/` tham chiếu.

## What Changes

**Drop (BREAKING – dọn rác):**
- Bảng: `appointments`, `appointment_services`, `appointment_status_history`, `appointment_payments`,
  `appointment_upsales`, `service_ledgers`, `money_audit`, `customer_services` (kèm trigger/policy/index của chúng).
- Function: `enforce_appointment_technician`, `log_appointment_status`, `log_ledger_updated`,
  `log_payment_deleted`, `prevent_upsale_delete_below_paid`.
- Cột `customers.deposit_currency` (luôn = `IDR`, không chỗ nào đọc — tiền tệ đã chuẩn hoá IDR ở code).
- Dòng `enum_options` kind `stage`/`source` (đã thay bằng `CUSTOMER_OPTIONS` hằng số; chỉ `lost_reason` còn dùng).
- Index không dùng: `customers_source_idx`, `customers_stage_idx`, `enum_options_kind_idx`,
  `profiles_email_idx`, `profiles_user_name_idx` (lọc/tìm làm client-side, bảng nhỏ).

**Tối ưu DB:**
- Thêm index FK đang thiếu: `clinic_appointments(staff_id)`, `tours(customer_id)`, `tours(service_id)`.
- Gộp policy RLS trùng: `profiles` 4 policy SELECT → 1; `services` 2 → 1; `enum_options`/`profiles`
  tách policy ghi admin khỏi SELECT (hết cảnh báo `multiple_permissive_policies`, `auth_rls_initplan`).

**Tối ưu code:**
- `/customers`: chọn cột tường minh, rút IG username bằng JSON path (`smax_data->customer->instagram->>username`)
  thay vì tải nguyên `smax_data` + `tags` rồi bỏ.
- `/appointments`: chỉ lấy `thread->>link` thay vì cả `thread` (có nội dung tin nhắn).
- Xoá `uploadImage` chết ở `lib/supabase/storage.ts`; bỏ ghi `deposit_currency` ở lead-form.

Giữ nguyên (có tính năng/UI dù chưa có dữ liệu): `customers.lost_reason`, `customers.sales_id`, `customers.technician_id`.

## Impact

- Migration: `supabase/migrations/20261112130000_db_cleanup.sql` (thay luôn `20261112120000_drop_customer_services.sql` nếu chưa chạy — file mới tự `drop if exists`).
- Code: `app/(app)/customers/page.tsx`, `app/(app)/appointments/page.tsx`, `lib/customer-options.ts`(+test),
  `app/lead-form/actions.ts`, `lib/supabase/storage.ts`, `types/customer.ts`.
- Thứ tự: deploy code trước, rồi chạy migration (code mới không còn ghi `deposit_currency`).
