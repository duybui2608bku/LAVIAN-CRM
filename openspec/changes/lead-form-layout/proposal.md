## Why

Sếp muốn form `/lead-form` (nhúng SMAX) sắp xếp lại cho dễ nhập theo thứ tự làm việc của Telesales, và nhìn rõ ô nào bắt buộc.

## What Changes

- Thứ tự mới (lưới 2 cột):
  1. Full name | Phone number
  2. Province | Regency / City (tách 2 ô có nhãn riêng — trước là 1 ô "Region" ở cuối form)
  3. Telesales | Status
  4. Appointment date & time | Nhóm dịch vụ (chỉ khi Status là Booking / Deposit, như cũ)
  5. Deposit | Payment confirm
  6. Note (cả hàng)
- Ô bắt buộc có **dấu sao đỏ sau nhãn** (`requiredMark` tuỳ biến của antd, tự theo `rules.required`): Full name, Phone, Telesales, Status, ngày giờ hẹn (chỉ khi vừa đổi sang Booking — đúng điều kiện bắt buộc hiện tại).
- Select Status hiện **chữ thường**, bỏ tag màu/icon.
- `RegionSelect` thêm prop tuỳ chọn `field` để bọc từng ô bằng nhãn riêng; nơi khác dùng như cũ.

## Impact

- `components/lead-form/lead-form.tsx`, `components/common/region-select.tsx`. Không đổi DB, không đổi dữ liệu gửi lên.
