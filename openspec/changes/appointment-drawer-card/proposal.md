## Why

Sếp muốn xem thông tin thẻ liệu trình ngay trong drawer lịch hẹn (Quản lý bán hàng → bấm tên khách). Hiện mục "Tài chính" chỉ có 3 con số (Giá trị thẻ / Đã thu / Công nợ): Sales không biết thẻ gồm dịch vụ gì, còn mấy buổi, muốn biết phải đóng drawer rồi bấm mã thẻ trên bảng.

## What Changes

- Mục **"Tài chính"** trong `AppointmentDrawer` đổi thành **"Thẻ liệu trình"** — **chỉ xem**:
  - Có thẻ: khung viền gồm mã thẻ + trạng thái (`CardStatusTag`) + nút "Mở thẻ" (mở `CardDrawer` chồng lên), danh sách dịch vụ (tên, nhóm · giá, "Đã dùng x/y buổi"; dòng đã hoàn gạch ngang), dải 3 số Giá trị thẻ / Đã thu / Công nợ ở đáy khung.
  - Chưa có thẻ: Tiền cọc chưa trừ + nút "Bán thẻ liệu trình" (khách đã đến + có quyền `cards.edit`), mở `CardItemsDrawer` như icon giỏ hàng trên bảng.
- **Không** đưa thu tiền / lộ trình tour / hoàn / huỷ thẻ vào drawer lịch hẹn — vẫn chỉ sửa ở drawer thẻ (1 nơi sửa duy nhất).

## Impact

- Sửa: `components/appointments/appointment-drawer.tsx`, `components/appointments/appointments-manager.tsx`, `messages/{vi,en}.json`.
- **Không** migration DB, **không** query mới (trang đã tải sẵn thẻ + tour của thẻ), **không** đổi server action.
