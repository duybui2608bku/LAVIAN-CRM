## Context

- `profiles` (migration `20260707120000`) đã có 2 enum Postgres `user_role`/`user_status` — pattern có sẵn cho enum cột user.
- `customers.staff_id` (migration `20260707140000`): `uuid references profiles on delete set null` + partial index; UI `/customers` dùng `InlineSelect` + `patchCustomer` whitelist + `ClearableSelect` lọc + field Controller trong form drawer; lọc client-side qua `matchesCustomerFilters` (`lib/customers.ts`).
- `/users` chỉ có dialog tạo + ban + reset mật khẩu — chưa có edit user, nên bộ phận cho user cũ cần sửa inline tại bảng.

## Goals / Non-Goals

**Goals:**
- Bộ phận cho user (2 giá trị cứng) setup được tại `/users`.
- `technician_id` trên customers, CRUD tại `/customers` sao chép đúng pattern `staff_id`.
- Dropdown kỹ thuật viên chỉ liệt kê user `department = 'technician'` (vẫn hiện giá trị cũ nếu user bị đổi bộ phận sau khi gán).

**Non-Goals:**
- Không đổi nghĩa/lọc trường Nhân viên (`staff_id`) hiện tại — vẫn hiện mọi user (tránh vỡ dữ liệu cũ khi user chưa gán bộ phận).
- Không đụng `appointments.staff_id`, không thống kê theo kỹ thuật viên (làm sau khi cần).
- Không quản lý bộ phận động (bảng riêng/enum_options) — 2 giá trị cố định là đủ (YAGNI).

## Decisions

1. **Enum Postgres `user_department` (`customer_care` | `technician`), cột nullable** — khớp pattern `user_role`/`user_status` sẵn có; nullable vì user cũ chưa gán, không cần backfill. Bỏ phương án dùng `enum_options` (danh mục động cho customer, không phải cho user; 2 giá trị cứng không cần CRUD).
2. **Sửa bộ phận qua action mới `setUserDepartment` (admin) + `ClearableSelect` inline trong cột bảng `/users`** — nhẹ hơn dựng cả dialog edit user chưa tồn tại.
3. **`technician_id` cùng shape `staff_id`**: `uuid references profiles on delete set null` + partial index `where deleted_at is null`. Đi qua `clean()`/`patchCustomer` whitelist như staff_id.
4. **Lọc dropdown kỹ thuật viên phía client**: page `/customers` query thêm `department` trong select profiles; component lọc `department === 'technician' || s.id === giá_trị_hiện_tại` (giữ hiển thị dữ liệu cũ — cùng triết lý option inactive của enum).
5. **i18n**: thêm key namespace `users` (bộ phận + 2 nhãn) và `customers` (cột/lọc kỹ thuật viên) cho cả 3 locale; nhãn bộ phận là text i18n tĩnh (không cần bảng).

## Risks / Trade-offs

- [User đổi bộ phận sau khi đã gán làm kỹ thuật viên] → giá trị cũ vẫn hiển thị trong cell/dropdown của khách đang gán (pattern "option inactive"); không tự gỡ.
- [Chưa gán bộ phận cho ai → dropdown kỹ thuật viên rỗng] → admin cần vào `/users` gán trước; UI vẫn hoạt động (select rỗng + "—").

## Migration Plan

1 file migration mới (idempotent): tạo type `user_department` trong `do $$ ... duplicate_object`, `alter table profiles add column if not exists department`, `alter table customers add column if not exists technician_id`, index `if not exists`. ROLLBACK comment cuối file. Chạy tay trong Supabase SQL Editor, không phụ thuộc migration khác ngoài 2 file nền tảng.
