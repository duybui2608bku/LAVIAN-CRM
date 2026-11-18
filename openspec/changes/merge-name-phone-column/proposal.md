## Why

Bảng khách hàng / lịch hẹn tách Tên và SĐT thành 2 cột → bảng rộng, phải cuộn ngang nhiều. Sếp muốn gộp cho gọn.

## What Changes

- Component dùng chung `NamePhone` (`components/common/name-phone.tsx`): tên 1 dòng (đậm), SĐT dòng dưới **chữ nhỏ `text-xs`, màu phụ**, line-height chặt để hàng không cao thêm nhiều; tên dài cắt `…` + tooltip `title`.
- Áp dụng mọi bảng có tên + SĐT:
  - `/customers` (và các trang dùng `CustomersManager`): bỏ cột SĐT, ô Họ tên giữ link hội thoại SMAX + nút mở drawer sửa.
  - `/appointments`: bỏ cột SĐT, gộp vào cột Tên (vẫn cố định trái).
  - `/tour`: cột Khách hàng đã gộp sẵn → đổi sang `NamePhone` cho đồng nhất.
- Giữ nguyên tiêu đề cột tên (SĐT ngay dưới tên đã tự rõ nghĩa) → không thêm key i18n. Tìm kiếm theo tên/SĐT không đổi.
- Không đổi: danh sách nhắc hẹn và chi tiết tour (đã hiện tên · SĐT trên 1 dòng), dropdown chọn khách.

## Impact

- `components/common/name-phone.tsx` (mới), `components/customers/customers-manager.tsx`, `components/appointments/appointments-manager.tsx`, `components/tour/tour-view.tsx`.
- Không đổi DB.
