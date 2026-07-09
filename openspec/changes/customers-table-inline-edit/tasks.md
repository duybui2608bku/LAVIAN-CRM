# Tasks: customers-table-inline-edit

## 1. Types + Actions

- [x] 1.1 `types/customer.ts`: bỏ `notes`/`note` khỏi `CustomerInput`
- [x] 1.2 `app/(app)/customers/actions.ts`: `clean()` không đụng notes (thành sync); thêm `patchCustomer(id, {stage?, source?, staff_id?})` — stage ≠ lost → `lost_reason: null`

## 2. UI (customers-manager.tsx)

- [x] 2.1 Dialog tạo/sửa: bỏ khối lịch sử note + ô thêm note + field `note` trong schema/values/onSubmit
- [x] 2.2 Xóa: thay `window.confirm` bằng AlertDialog dùng chung (state `deleting`), nút Xóa destructive
- [x] 2.3 `InlineSelect` + dùng cho 3 ô Giai đoạn/Nguồn/Nhân viên (trigger = tag/tên, `__none` bỏ chọn cho source/staff, gọi `patchCustomer`, toast + refresh, disable khi pending)

## 3. i18n + Kiểm chứng

- [x] 3.1 Bổ sung key i18n còn thiếu (tiêu đề/mô tả confirm xóa) cho vi/en/id; dọn key không dùng nếu chắc chắn (noteHistory)
- [x] 3.2 `tsc --noEmit` + `next build` PASS; cập nhật memory-bank
