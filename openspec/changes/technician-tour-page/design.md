## Decisions

- **Server lọc theo KTV, client lọc theo tháng:** page server lấy toàn bộ lịch `checked_in` của KTV; lọc tháng bằng dayjs ở trình duyệt, giống cách `/appointments` lọc ngày (theo múi giờ người xem). Dữ liệu mỗi KTV nhỏ, tránh phải xử lý múi giờ ở server.
- **Chọn KTV qua query `?technician=`:** chỉ admin được dùng; non-admin luôn bị ép về `profile.id`, bỏ qua query.
- **Không thêm RLS mới:** bảng vốn đọc chung cho nhân viên active (CRM nội bộ). Trang chỉ là chế độ xem.

## Risks / Trade-offs

- Nhân viên rành kỹ thuật vẫn có thể đọc lịch người khác qua API (RLS chung). Chấp nhận như các bảng khác; siết RLS là việc riêng nếu cần.
