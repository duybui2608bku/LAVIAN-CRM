## Why

Khách hàng cần được gán **kỹ thuật viên** (người trực tiếp làm dịch vụ) bên cạnh nhân viên tư vấn/chăm sóc hiện tại (`staff_id`). Hiện tại user không có khái niệm bộ phận nên không phân biệt được ai là kỹ thuật viên để chọn.

## What Changes

- Thêm cột `department` cho `public.profiles` (2 giá trị: `customer_care` — Chăm sóc khách hàng, `technician` — Kỹ Thuật Viên; nullable — user cũ chưa gán).
- Trang `/users` (admin): chọn bộ phận khi tạo user + cột Bộ phận sửa inline cho user sẵn có.
- Thêm cột `customers.technician_id` (FK → profiles, on delete set null).
- Trang `/customers`: cột Kỹ thuật viên (avatar + tên, sửa inline), bộ lọc theo kỹ thuật viên, field trong form drawer tạo/sửa — cùng pattern với trường Nhân viên hiện tại. Dropdown kỹ thuật viên **chỉ hiện user thuộc bộ phận Kỹ Thuật Viên**.

## Capabilities

### New Capabilities
- `user-department`: Bộ phận của user — cột DB, setup ở trang quản lý user.
- `customer-technician`: Gán kỹ thuật viên cho khách hàng — cột DB + CRUD (cột bảng, inline edit, bộ lọc, form) tại `/customers`.

### Modified Capabilities

(Không có — spec chính chưa tồn tại trong `openspec/specs/`.)

## Impact

- DB: migration mới `supabase/migrations/` (enum `user_department`, cột `profiles.department`, cột `customers.technician_id` + index).
- Code: `types/user.ts`, `types/customer.ts`, `lib/customers.ts` (filter), `app/(app)/users/{actions,page}.tsx`, `components/users/users-manager.tsx`, `app/(app)/customers/{actions,page}.tsx`, `components/customers/customers-manager.tsx`, `messages/{vi,en,id}.json`.
- Không đụng lịch hẹn (`appointments.staff_id` giữ nguyên nghĩa cũ).
