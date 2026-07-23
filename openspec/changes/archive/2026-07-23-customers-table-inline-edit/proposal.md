# Proposal: customers-table-inline-edit

## Why

Trang /customers hiện có 3 điểm cọ xát trong thao tác hằng ngày: (1) dialog tạo/sửa khách lặp lại phần ghi chú đã có sẵn ở bảng (QuickNote + dialog lịch sử) làm form dài không cần thiết; (2) xóa khách dùng `window.confirm` native — lệch tông với phần còn lại của app (đăng xuất đã dùng AlertDialog shadcn); (3) đổi Giai đoạn/Nguồn/Nhân viên — thao tác thường xuyên nhất — phải mở dialog sửa đầy đủ.

## What Changes

- Bỏ khối "Lịch sử ghi chú" + ô "Thêm ghi chú" khỏi `CustomerDialog` (tạo/sửa). Ghi chú chỉ còn quản lý qua cột Ghi chú ở bảng (QuickNote popover + dialog lịch sử).
- Thay `window.confirm` khi xóa khách bằng **AlertDialog shadcn** (popconfirm) — tiêu đề + mô tả + Huỷ/Xóa (destructive).
- Ô Giai đoạn / Nguồn / Nhân viên trên bảng thành **inline edit**: click vào tag/tên mở Select, chọn xong lưu ngay (server action cập nhật từng trường), toast + refresh.

## Capabilities

### New Capabilities

_(không có — chỉ sửa hành vi capability hiện có)_

### Modified Capabilities

- `customer-management`: (a) dialog tạo/sửa không còn chứa lịch sử/thêm ghi chú; (b) xác nhận xóa bằng AlertDialog thay confirm native; (c) stage/source/staff_id sửa được trực tiếp từng ô trên bảng.

## Impact

- `components/customers/customers-manager.tsx` — bỏ khối notes trong dialog, AlertDialog xóa, 3 ô inline edit.
- `app/(app)/customers/actions.ts` — thêm action cập nhật từng trường (patch) cho inline edit.
- `types/customer.ts` — `CustomerInput.notes`/`note` không còn gửi từ dialog (dọn nếu thành dư).
- `messages/{vi,en,id}.json` — key cho nút xác nhận xóa nếu thiếu.
- Không đổi DB/RLS — không cần migration.
