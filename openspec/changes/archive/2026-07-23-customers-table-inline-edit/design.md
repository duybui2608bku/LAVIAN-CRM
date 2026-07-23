# Design: customers-table-inline-edit

## Context

`components/customers/customers-manager.tsx` render bảng + dialog form (react-hook-form + zod) + QuickNote/lịch sử note. Xóa dùng `window.confirm`. `app/(app)/customers/actions.ts` có create/update (nhận full `CustomerInput`), `addCustomerNote`, `deleteCustomer`. AlertDialog shadcn đã có sẵn (`components/ui/alert-dialog.tsx`, đang dùng cho đăng xuất). Select shadcn đã có (`ClearableSelect`).

## Goals / Non-Goals

**Goals:**
- Dialog tạo/sửa gọn: chỉ còn thông tin khách, không còn phần ghi chú.
- Xác nhận xóa đồng bộ UI shadcn.
- Đổi stage/source/staff 1 click ngay trên bảng.

**Non-Goals:**
- Không đổi DB/RLS/migration.
- Không inline edit các cột khác (tên, phone, ngày…).
- Không optimistic update — chờ server rồi refresh (đơn giản, dữ liệu nhỏ).

## Decisions

1. **Bỏ hẳn `notes`/`note` khỏi `CustomerInput`** thay vì chỉ giấu UI. `clean()` không đụng `notes` nữa → update không ghi đè cột `notes` (create dựa default `[]` của DB). Tiện thể **fix luôn race** "dialog gửi snapshot notes đè note thêm từ popover" đã ghi nhận. `stampNote` chỉ còn dùng bởi `addCustomerNote`.
2. **Popconfirm = AlertDialog shadcn** (không có component Popconfirm chính thức trong shadcn; AlertDialog là pattern chuẩn, codebase đã dùng cho đăng xuất). State `deleting: Customer | null` + 1 AlertDialog dùng chung ngoài vòng map (nhẹ hơn render 1 dialog/dòng).
3. **Inline edit = Radix Select với trigger tuỳ biến**: component nhỏ `InlineSelect` trong chính file manager — `Select` bọc trigger là nút ghost hiển thị nội dung hiện tại (EnumTag/tên/"—"), `SelectContent` liệt kê option; sentinel `__none` cho mục bỏ chọn (Radix không nhận value rỗng — pattern sẵn có trong codebase). Không tái dùng `ClearableSelect` vì trigger của nó là ô select chuẩn (viền + chevron), không hiển thị được EnumTag.
4. **Server action `patchCustomer(id, patch)`** — whitelist `{stage?, source?, staff_id?}`; khi `stage` đổi sang khác `lost` thì set `lost_reason = null` (đồng nhất `clean()`). Không dùng `updateCustomer` vì nó đòi full input.

## Risks / Trade-offs

- [Đổi stage sang `lost` inline không hỏi lý do] → lost_reason để trống, user bổ sung qua dialog sửa; chấp nhận (nhanh hơn là chặn).
- [Không optimistic] → có độ trễ nhỏ giữa chọn và tag đổi; disable select khi pending + toast là đủ.
