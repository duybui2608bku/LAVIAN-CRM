## 1. Database
- [x] 1.1 Migration thêm `sales_notes jsonb` + check mảng + chuyển `sales_note` cũ

## 2. Server
- [x] 2.1 `addSalesNote(id, {title, text})` — append, server stamp người ghi + thời gian
- [x] 2.2 `deleteSalesNote(id, noteId)` — chỉ người ghi hoặc admin
- [x] 2.3 Trang `/appointments` select `sales_notes`; bỏ `sales_note` khỏi patch schema

## 3. UI
- [x] 3.1 `SalesNotesDrawer`: ô soạn (chip tiêu đề gợi ý, Ctrl+Enter) + timeline
- [x] 3.2 Cột Note Sales trên bảng mở drawer
- [x] 3.3 Mục 4 drawer Sửa lịch hẹn: xem nhanh + nút mở drawer
- [x] 3.4 i18n vi/en

## 4. Kiểm tra
- [x] 4.1 tsc + eslint
