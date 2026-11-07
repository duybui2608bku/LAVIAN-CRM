## Decisions

- **Đăng xuất:** `useConfirm()` dùng `modal.confirm` của `<App>` ở root layout (không bị gỡ khi đổi route). `onOk` trả Promise của server action có `redirect()` → Promise không resolve → modal treo trên `/login`. Sửa: `signOut()` chỉ `auth.signOut()`; `onOk: async () => { await signOut(); window.location.replace("/login") }` — modal giữ loading tới khi trang tải lại, rồi mọi state client mất sạch (an toàn hơn cho máy dùng chung). Trang `/banned` dùng form action riêng `signOutAndRedirect` (giữ redirect phía server).
- **Select giật:** `rc-virtual-list` tự xử lý `touchmove` (cuộn bằng JS, không quán tính) → giật trên điện thoại. `ConfigProvider virtual={!touch}` → cuộn native. Danh sách tối đa vài trăm dòng nên tắt virtual không đáng kể về hiệu năng. Thêm `overscroll-behavior: contain` cho `.ant-select-dropdown .rc-virtual-list-holder` và `.ant-picker-dropdown`.
- **DatePicker:** cảm ứng → `inputReadOnly` (chọn bằng lịch, không bàn phím). `ConfigProvider` không có option này nên truyền ở wrapper `components/common/date-picker.tsx` và các chỗ dùng DatePicker antd trực tiếp. Gom gợi ý `mobile`/`touch` vào 1 context `UiHintContext` (`hooks/use-is-mobile.tsx`) với hook `useIsMobile()` + `useIsTouch()`; `AntdProvider` dùng lại `useIsTouch()` thay bản tự viết.
- **Bottom tab bar:** render trong `AppShell` khi `< md` (CSS `md:hidden`, không cần JS). 3 tab chính + "Menu". Tab active theo `pathname`. Cao 56px + `env(safe-area-inset-bottom)`. Nội dung có `padding-bottom` tương ứng (chỉ `< md`). Menu = antd `Drawer placement="bottom"` (bottom sheet, bo góc trên) chứa: mục admin (nếu admin) dạng lưới icon, rồi dòng tài khoản (avatar + tên), giao diện tối (Switch), ngôn ngữ (3 nút cờ), đăng xuất.
- **Thanh trên:** giữ `h-13`, thêm `padding-top: env(safe-area-inset-top)`; bỏ nút ☰.
- **Manifest:** `app/manifest.ts`, `start_url: "/"`, `display: "standalone"`, `background_color`/`theme_color` = `THEME_BG.light`. Icon sinh 1 lần bằng `sharp` (có sẵn trong node_modules) từ `app/icon.png` → `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png` (logo thu 80% trên nền trắng).
- **Viewport:** `viewportFit: "cover"` để dùng safe-area; không đặt `maximumScale` (giữ pinch-zoom).

## Risks

- Tắt virtual: select hàng nghìn dòng sẽ render chậm hơn — hiện chưa có danh sách cỡ đó (khách hàng lọc theo chữ).
- Không có service worker → Chrome Android có thể chỉ hiện "Thêm vào màn hình chính" (shortcut) thay vì prompt cài đặt; vẫn mở standalone nhờ manifest.
