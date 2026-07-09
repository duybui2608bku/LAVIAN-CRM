# Proposal: add-customer-notes-column

## Why

Ghi chú khách hàng hiện bị chôn trong dialog Sửa: muốn xem lịch sử hay thêm note nhanh đều phải mở form sửa đầy đủ. Nhân viên telesale cần thao tác note ngay trên bảng (thêm nhanh + xem lịch sử), và cần biết **ai** đã ghi note — hiện notes chỉ lưu `{text, at}`, không có người ghi.

## What Changes

- Bảng `/customers` thêm cột **Ghi chú** với 2 nút icon:
  - **Plus**: mở Popover có ô nhập + nút lưu — thêm note nhanh không cần mở dialog sửa.
  - **Info**: mở Dialog "Lịch sử ghi chú - {tên khách}" liệt kê các note (thời điểm, người ghi, nội dung), mới nhất trước.
- Mỗi note lưu thêm trường `by` (tên người ghi). **Server stamp** cả `at` lẫn `by` (không tin client): Server Action mới `addCustomerNote(id, text)`; dialog tạo/sửa chuyển sang gửi text note mới rời (`CustomerInput.note`) thay vì client tự append `{text, at}`.
- Không cần migration DB: `customers.notes` là jsonb, trường `by` nằm trong JSON.
- Note cũ không có `by` → hiển thị "—".

## Capabilities

### New Capabilities

_(không có — mở rộng capability sẵn có)_

### Modified Capabilities

- `customer-management`: bảng khách hàng có cột Ghi chú (thêm nhanh qua popover, xem lịch sử qua dialog); note ghi nhận người tạo do server stamp.

## Impact

- `types/customer.ts` — `CustomerNote.by?`, `CustomerInput.note?` (bỏ client append).
- `app/(app)/customers/actions.ts` — stamp note server-side trong create/update; thêm `addCustomerNote`.
- `components/customers/customers-manager.tsx` — cột mới + Popover thêm note + Dialog lịch sử; dialog sửa gửi `note` text, lịch sử hiện người ghi.
- `messages/{vi,en,id}.json` — key i18n mới.
- DB: không đổi schema (jsonb).
