# Proposal: follow-up-rules

## Why

Rà BA (2026-11-19) sau `lead-form-follow-up` còn 3 lỗ hổng quanh luồng Khách tiềm năng:

1. Quy tắc "Tiềm năng / Cân nhắc phải có lịch nhắc" chỉ chặn ở lead form. Ở CRM (`/customers` sửa inline + drawer) đổi stage sang 2 stage này không cần `follow_up_at` → khách không vào tab Quá hạn/Hôm nay, không có thông báo.
2. "Cân nhắc" có 2 chỗ: stage `consider` và tình trạng `potential_status = considering` — trùng nghĩa, có thể mâu thuẫn.
3. `converted_at` chỉ được ghi khi bấm "Chuyển đổi đặt lịch" ở trang tiềm năng. Đổi sang Booking từ lead form / sửa inline / drawer / trigger Show-up thì không ghi → thẻ "Chuyển đổi hôm nay" đếm thiếu.

## What Changes

- **DB (migration `20261119090000_follow_up_rules.sql`):**
  - Bỏ giá trị `considering` khỏi `potential_status` (dữ liệu cũ → null), sửa check constraint.
  - Check constraint `customers_follow_up_required`: stage `potential`/`consider` thì `follow_up_at` bắt buộc.
  - Trigger `BEFORE UPDATE OF stage` trên `customers`: rời Tiềm năng/Cân nhắc sang `deposited`/`booked`/`show_up`/`purchase` → ghi `converted_at = now()`, `potential_status = 'converted'`, xoá `follow_up_at`. Quay lại Tiềm năng/Cân nhắc từ stage khác → bỏ `potential_status = 'converted'`. Rời sang `consulting` không tính chuyển đổi, chỉ xoá `follow_up_at`.
- **CRM `/customers`:** chọn Tiềm năng/Cân nhắc ở ô stage inline → mở Modal chọn "Lịch nhắc follow-up" (bắt buộc) rồi mới lưu. Drawer tạo/sửa khách hiện ô "Lịch nhắc follow-up" (bắt buộc) khi stage là Tiềm năng/Cân nhắc.
- **Server action:** `createCustomer`/`updateCustomer`/`patchCustomer` chặn stage Tiềm năng/Cân nhắc thiếu lịch nhắc (thông báo thân thiện, constraint DB là chốt chặn cuối).

## Impact

- `supabase/migrations/20261119090000_follow_up_rules.sql` (mới)
- `lib/customer-options.ts` (bỏ `considering`), `types/customer.ts` (`CustomerInput.follow_up_at`)
- `app/(app)/customers/{actions.ts,customers-view.tsx,potential/page.tsx}`
- `components/customers/customers-manager.tsx`
- Lead form / `convertPotentialCustomer` không phải sửa (trigger lo phần chuyển đổi).
