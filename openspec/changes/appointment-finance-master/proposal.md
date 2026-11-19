# Proposal: appointment-finance-master

## Why

Sếp gửi mẫu bảng "Sales Management" cho trang Lịch hẹn: mỗi lịch cần thấy ngay tiền (cọc + giá trị dịch vụ) và người làm (Master/KTV), bớt cột thừa, và mở nhanh hồ sơ khách mà không rời trang. Hiện `/appointments` có cột Telesales (không cần ở đây), cột Nhóm dịch vụ chiếm chỗ riêng, chưa có Bill hay KTV theo lịch, và muốn xem thông tin khách phải sang `/customers`.

## What Changes

- **DB (migration `20261119110000_appointment_bill_technician.sql`):**
  - `clinic_appointments.bill_amount bigint` (Giá trị DV, IDR, `>= 0`, nullable).
  - `clinic_appointments.technician_id uuid` FK `profiles` `on delete set null` + index (Master của lịch).
  - Trigger log `log_clinic_appointment_change` theo dõi thêm `technician_id`, `bill_amount`.
- **`/appointments` bảng:**
  - Ẩn cột Telesales (giữ code dạng comment, dữ liệu `staff_id` vẫn ghi).
  - Bỏ cột Nhóm dịch vụ; nhóm DV hiện sau SĐT ở ô Khách hàng (`SĐT · Sulam Alis`), bấm vào vẫn sửa được.
  - Ô Khách hàng có icon mở **drawer Thông tin khách hàng** (chỉ xem): định danh, nguồn, giai đoạn, nhân viên phụ trách, cọc + ảnh xác nhận, khu vực/địa chỉ, lịch nhắc, ghi chú.
  - Cột **Tài chính (IDR)**: dòng Deposit (`customers.deposit_amount`, chỉ xem) + dòng Giá trị DV (`bill_amount`, sửa inline).
  - Cột **Master**: chọn KTV (user bộ phận `technician`), trống = "Chưa phân công".
- **Server:** `appointmentPatchSchema` nhận `bill_amount`, `technician_id`; `validateReferences` kiểm KTV đúng bộ phận; action mới `getCustomerDetail` cho drawer (tải khi mở).
- **Lịch sử lịch hẹn** (drawer ở `/customers`): hiển thị thay đổi Master / Giá trị DV.

## Impact

- `supabase/migrations/20261119110000_appointment_bill_technician.sql` (mới) — **chạy trước khi deploy code**.
- `types/appointment.ts`, `lib/appointments.ts`, `app/(app)/appointments/{actions.ts,page.tsx}`
- `components/appointments/appointments-manager.tsx`, `components/customers/customer-info-drawer.tsx` (mới), `components/customers/appointment-history-drawer.tsx`, `components/common/name-phone.tsx`
- `messages/{vi,en}.json`
- Booking management, lead form, Tour không đổi hành vi.
