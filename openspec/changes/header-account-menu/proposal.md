## Why

Menu tài khoản (Hồ sơ, Giao diện tối, Ngôn ngữ, Đăng xuất) đang nằm ở đáy sidebar. Cần đưa lên header để có chỗ
đặt chuông thông báo cạnh avatar (vị trí quen thuộc của app web).

## What Changes

- Desktop (≥ md): thêm thanh header sticky cao 56px (khớp hàng logo sidebar) trong vùng nội dung:
  trái = nút thu gọn/mở sidebar (chuyển từ đáy sidebar lên), phải = chuông thông báo + nút tài khoản (avatar + tên,
  dropdown mở xuống, đủ mục cũ). Bỏ phần đáy sidebar.
- Điện thoại: thanh trên có sẵn thêm chuông cạnh avatar (avatar vẫn mở bottom sheet Menu).
- Chuông thông báo: component `NotificationBell` (Popover, hiện trạng thái trống "Chưa có thông báo").
  Chưa có backend thông báo — làm sau (bảng, realtime, badge số chưa đọc).

## Impact

- `components/layout/app-shell.tsx`, `components/layout/notification-bell.tsx` (mới), `messages/{en,vi}.json`.
- Không đổi DB.
