## Why

Cần thêm vị trí **Customer care leader** và cho admin tự cấu hình quyền theo bộ phận (vào menu nào, được sửa/xoá hay chỉ xem)
thay vì cố định "staff chỉ vào /customers + /services".

## What Changes

- DB: thêm giá trị `customer_care_leader` vào enum `user_department`; bảng `department_permissions(department pk, permissions text[])`.
  Key quyền dạng `<module>.<action>` — module: customers, appointments, tour, services, reports, marketing, enums;
  action: view / edit (tạo + sửa) / delete. Seed giữ nguyên hành vi cũ: mọi bộ phận có customers.*, services.*,
  appointments.edit/delete (tạo lịch hẹn từ drawer khách). Leader thêm appointments.view.
  Hàm `has_permission(key)` (admin → luôn true) thay `is_admin()` ở policy ghi `enum_options`.
- Admin luôn toàn quyền. User chưa gán bộ phận → không quyền nào (trang chủ hiện "Chưa được cấp quyền").
  Trang /users + cấu hình quyền **chỉ admin** (tránh tự nâng quyền).
- `lib/permissions.ts`: danh sách module/action, `can(profile, key)`; `requirePermission(key)` ở `lib/auth.ts`.
- Proxy: chặn route theo `<module>.view`; `/` về menu đầu tiên được phép.
- Server actions dùng `requirePermission` thay `requireAdmin` / thêm kiểm tra cho customers, appointments, services, enums, reports, marketing.
  Tour: quyền quản lý (xác nhận, gán KTV, xem tất cả) = `tour.edit`.
- Shell: menu lọc theo quyền; context `useCan()` để ẩn nút sửa/xoá.
- Menu "Người dùng" thành menu con: **Danh sách** (`/users`) + **Phân quyền** (`/users/permissions`).
  Trang Phân quyền: trái = danh sách bộ phận (số nhân viên, số quyền, chấm = chưa lưu), phải = cây checkbox
  menu → Xem / Thêm-Sửa / Xoá (`Tree` checkable). Sửa nháp nhiều bộ phận rồi "Lưu thay đổi" 1 lần, có "Hoàn tác".
  `normalizePermissions`: chọn Sửa/Xoá tự bật Xem, bỏ Xem tắt cả menu.
- Leader được tính là CSKH ở các ô chọn nhân viên CSKH.

## Impact

- `supabase/migrations/20261113150000_department_permissions.sql`, `types/user.ts`, `lib/permissions.ts`, `lib/auth.ts`, `proxy.ts`,
  `app/(app)/**/{page,actions}.ts(x)`, `components/layout/app-shell.tsx`, `components/users/*`, các manager ẩn nút,
  `messages/{vi,en,id}.json`.
