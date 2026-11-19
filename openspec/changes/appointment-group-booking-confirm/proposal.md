## Why

Sales Management (`/appointments`): Sales muốn xem lịch theo từng nhóm Xác nhận lịch (Chờ xác nhận / Đã xác nhận / Khách hủy / Đổi lịch) để xử lý theo nhóm, thay vì lọc lần lượt từng giá trị.

## What Changes

- Thanh lọc thêm nút bật/tắt **Nhóm theo Xác nhận lịch** (đang bật = nút tô màu primary, `aria-pressed`).
- Bật: bảng tách thành từng nhóm theo thứ tự `BOOKING_STATUSES`. Mỗi nhóm có tiêu đề (tag trạng thái + "n lịch hẹn") và bảng riêng, phân trang riêng 30 dòng. Nhóm trống bị ẩn. Vẫn áp mọi bộ lọc khác; thẻ số liệu không đổi.
- Tắt: bảng phẳng như cũ.

## Impact

- Sửa: `components/appointments/appointments-manager.tsx`, `messages/{vi,en}.json` (`appointments.groupByConfirm`).
- Không DB, không API.
