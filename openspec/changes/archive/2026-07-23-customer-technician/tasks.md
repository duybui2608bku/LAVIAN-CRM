## 1. Database

- [x] 1.1 Migration `supabase/migrations/20260723090000_user_department_customer_technician.sql` (idempotent): enum `user_department` (`customer_care`|`technician`) trong `do $$`; `profiles.department` add column if not exists (nullable); `customers.technician_id uuid references profiles on delete set null` + partial index; comment mục đích + ROLLBACK

## 2. Types + lib

- [x] 2.1 `types/user.ts`: `UserDepartment` + `department` trên `Profile`
- [x] 2.2 `types/customer.ts`: `technician_id` vào `Customer` + `CustomerInput`
- [x] 2.3 `lib/customers.ts`: `technicianId` vào `CustomerFilters` + `matchesCustomerFilters` (+ test trong `lib/customers.test.ts`)

## 3. Trang /users

- [x] 3.1 `app/(app)/users/actions.ts`: `createUser` nhận `department`; action mới `setUserDepartment(id, department|null)` (requireAdmin, admin client)
- [x] 3.2 `components/users/users-manager.tsx`: cột "Bộ phận" inline `ClearableSelect` (2 option i18n) + select bộ phận trong dialog tạo user
- [x] 3.3 `app/(app)/users/page.tsx`: không cần sửa — page select `*` nên tự có `department`

## 4. Trang /customers

- [x] 4.1 `app/(app)/customers/page.tsx`: select profiles thêm `department`
- [x] 4.2 `app/(app)/customers/actions.ts`: `clean()` + `patchCustomer` whitelist thêm `technician_id`
- [x] 4.3 `components/customers/customers-manager.tsx`: helper `technicianOptions` (lọc `department==='technician'` + giá trị hiện tại); cột Kỹ thuật viên (InlineSelect + staffDisplay), bộ lọc ClearableSelect, field Controller trong CustomerDialog (colSpan bảng 11→12)

## 5. i18n

- [x] 5.1 `messages/{vi,en,id}.json`: `users.colDepartment` + `users.dept_customer_care` + `users.dept_technician` (+ `departmentOk`, `clearDepartment`); `customers.colTechnician` + `customers.allTechnician`

## 6. Kiểm chứng

- [x] 6.1 `node --test lib/customers.test.ts` 8/8 PASS + `tsc --noEmit` sạch + eslint 0 error (2 warning `watch()` quen thuộc) + JSON.parse 3 locale OK
- [x] 6.2 Cập nhật `memory-bank/README.md` (bullet trạng thái + mục nhật ký)
