# Tasks: customer-service-ledger

## 1. Migration DB

- [x] 1.1 Tạo `supabase/migrations/<ts>_service_ledgers.sql` (chạy SAU 20260715150000): bảng `service_ledgers` + unique partial index sổ mở + RLS/grant (authenticated, có update) + trigger `set_updated_at`
- [x] 1.2 Cùng file: thêm `appointments.ledger_id` (FK set null) + `appointment_payments.ledger_id` (FK cascade, nullable); đổi `appointment_payments.appointment_id` thành nullable + on delete set null
- [x] 1.3 Cùng file: backfill bọc `do $$` guard cột `expected_amount` (gom lịch theo (customer, service nhỏ nhất), tổng giá = coalesce(final, expected) lịch mới nhất, set ledger_id 2 bảng) rồi drop `expected_amount` + `final_amount`; ghi script ROLLBACK cuối file

## 2. Types + helpers

- [x] 2.1 `types/appointment.ts`: interface `ServiceLedger`; `Appointment` bỏ `expected_amount`/`final_amount`, thêm `ledger_id` + `ledger`; `AppointmentInput` đổi 2 field tiền thành `total_amount?`, `service_ids` giữ (gửi mảng 1 phần tử)
- [x] 2.2 `lib/appointments.ts`: `ledgerPaid(l)`; `paidTotal`/`outstanding` theo `a.ledger` (fallback `a.payments` khi không sổ); XÓA `dayTotal`; cập nhật + thêm test `lib/appointments.test.ts` (chung sổ 2 lịch, fallback không sổ, dedupe tổng đã trả) — bỏ test dayTotal

## 3. Server actions (`app/(app)/appointments/actions.ts`)

- [x] 3.1 Helper `resolveLedger(supabase, customerId, serviceId)`: select sổ mở → insert `on conflict do nothing` → select lại; trả id
- [x] 3.2 `createAppointment`: validate `service_ids?.length === 1` (lỗi "Chọn đúng một dịch vụ."); resolve ledger, set `ledger_id`; `total_amount !== undefined` → update sổ; dòng deposit ghi kèm `ledger_id` + `appointment_id`
- [x] 3.3 `updateAppointment`: validate 1 dịch vụ; đổi khách/dịch vụ → resolve lại ledger + dời dòng tiền `appointment_id = lịch` sang sổ mới + adopt dòng mồ côi (`ledger_id is null`); update total sổ khi gửi
- [x] 3.4 `setAppointmentStatus` completed: `extra.total_amount` update sổ (bỏ `final_amount`/`payment_method` patch cột đã drop); dòng `collect` ghi kèm `ledger_id`
- [x] 3.5 `addPayment`: nhận theo appointment như cũ nhưng ghi `ledger_id` của lịch; từ chối khi sổ `closed_at` ("Sổ đã tất toán.") hoặc lịch chưa có sổ
- [x] 3.6 Action mới `setLedgerClosed(id, closed)`: đóng/mở lại; mở lại vi phạm unique sổ mở → lỗi rõ ràng
- [x] 3.7 `app/(app)/services/actions.ts` `deleteService`: thêm đếm `service_ledgers` vào guard chặn xóa

## 4. Page queries

- [x] 4.1 `app/(app)/appointments/page.tsx` + `app/(app)/customers/page.tsx`: nested thêm `service_ledgers` (kèm `appointment_payments(*)` dưới sổ), giữ nested payments theo lịch cho fallback; map vào `Appointment.ledger`

## 5. UI

- [x] 5.1 `appointment-dialog.tsx`: dịch vụ → `ClearableSelect` đơn bắt buộc (zod min(1), submit `[service_id]`); ô Báo giá/Doanh số → 1 ô "Tổng giá" (prefill từ sổ mở tìm trong data khi chọn khách+dịch vụ, kèm dòng "Sổ hiện có — đã thu X"); badge "Khách cũ" cạnh ô chọn khách (prop `returningIds`)
- [x] 5.2 `appointments-manager.tsx`: cột Báo giá/Doanh số → "Tổng giá"; Đã thu/Còn nợ theo sổ; badge "Khách cũ" cạnh tên; XÓA dòng tổng doanh thu ngày; CompletePopover field tổng giá thay doanh số chốt; tính `returningIds` truyền dialog
- [x] 5.3 `payments-dialog.tsx`: hiển thị theo sổ của lịch (title kèm tên dịch vụ, dòng mọi buổi); nút Tất toán/Mở lại + badge sổ đóng + ẩn form thêm khi đóng; chặn overpay theo `ledger.total`; lịch không sổ → thông báo chọn dịch vụ
- [x] 5.4 `customers-manager.tsx`: dialog lịch sử — Đã thu theo sổ, "Tổng đã trả" dedupe theo sổ + tiền mồ côi; nút Đặt lịch truyền `returningIds`
- [x] 5.5 i18n 3 locale: +key (totalAmount, returningCustomer, ledgerClosed, closeLedger, reopenLedger, ledgerHint…), −key (expected, final, dayTotal…); đồng bộ mọi chỗ dùng

## 6. Kiểm chứng

- [x] 6.1 `node --test lib/appointments.test.ts` PASS; `tsc --noEmit` sạch; eslint file sửa sạch; JSON 3 locale parse OK; `next build` PASS
- [x] 6.2 Cập nhật `memory-bank/README.md` (mục nhật ký + trạng thái hiện tại)
