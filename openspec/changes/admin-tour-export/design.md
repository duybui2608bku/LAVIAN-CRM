## Decisions

- **Dữ liệu:** page server lấy lịch `checked_in` trong khoảng tháng ±1 ngày (khi admin chọn "Tất cả": mọi lịch có `technician_id`), client lọc chính xác theo tháng bằng dayjs (giữ cách tính múi giờ như cũ). Tên KTV lấy từ 1 query `profiles` (không lọc bộ phận để KTV đã đổi bộ phận vẫn có tên); select chỉ liệt kê `department = 'technician'`.
- **Gom nhóm:** dùng tree data của antd Table (`children`) — dòng nhóm có key `group:<id>`, hiển thị tổng; không thêm thư viện.
- **Excel:** `exceljs` qua `import()` động. Mỗi KTV: dòng tiêu đề nhóm, các dòng lịch, dòng "Tổng". Cuối file "Tổng cộng". Tiền là số (định dạng `#,##0`) để Excel cộng được.
- **PDF:** không dùng thư viện PDF (font mặc định jsPDF không có dấu tiếng Việt cho tên khách). Render phiếu bằng HTML qua portal vào `body`, CSS `@media print` ẩn phần còn lại, gọi `window.print()`; người dùng chọn "Save as PDF". Nội dung phiếu cố định tiếng Anh, mỗi KTV `break-after: page`.

## Risks

- Hộp thoại in phụ thuộc trình duyệt (người dùng phải chọn "Save as PDF").
