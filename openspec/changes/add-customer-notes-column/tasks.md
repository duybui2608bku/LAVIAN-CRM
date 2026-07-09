# Tasks: add-customer-notes-column

## 1. Types + Server Actions

- [x] 1.1 `types/customer.ts`: `CustomerNote.by?: string | null`; `CustomerInput` thêm `note?: string` (text note mới, server stamp).
- [x] 1.2 `app/(app)/customers/actions.ts`: helper stamp note (`getCurrentProfile()` → `{text, at, by}`); `clean()`/create/update append note mới từ `input.note`; thêm `addCustomerNote(id, text)` (đọc notes từ DB → append → update).

## 2. UI bảng /customers

- [x] 2.1 `components/customers/customers-manager.tsx`: thêm cột Ghi chú — nút Plus (Popover: textarea + Lưu, disable rỗng/pending) + nút Info (disable khi chưa có note).
- [x] 2.2 Dialog "Lịch sử ghi chú - {tên}": danh sách mới nhất trước, mỗi mục badge thời gian + người ghi ("—" nếu thiếu `by`) + nội dung.
- [x] 2.3 Dialog tạo/sửa: bỏ client append `{text, at}` → gửi `note` text; lịch sử trong dialog hiện người ghi.

## 3. i18n + kiểm chứng

- [x] 3.1 `messages/{vi,en,id}.json`: key mới (colNotes, viewNotes, noteHistoryTitle, noteOk).
- [x] 3.2 `tsc --noEmit` + `next build` PASS; cập nhật memory-bank.
