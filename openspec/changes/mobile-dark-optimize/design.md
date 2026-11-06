## Decisions

- **Chống nháy dark:** `next-themes` lưu theme ở localStorage (server không đọc được). `AntdProvider` ghi thêm cookie `theme-resolved=dark|light` mỗi khi `resolvedTheme` đổi; root layout đọc cookie → prop `hints.dark`. Trước khi mount antd dùng `initial.dark`, sau mount dùng `resolvedTheme` — server và lượt hydrate cùng giá trị nên không lệch hydration. Lần đầu tiên (chưa có cookie) vẫn có thể nháy 1 lần.
- **Cảm ứng:** `useSyncExternalStore` theo `matchMedia("(pointer: coarse)")`; server snapshot = đoán từ User-Agent (`userAgent()` của `next/server`, device type mobile/tablet). `controlHeight` 40 khi cảm ứng (antd tự suy ra padding/size các component).
- **iOS auto-zoom:** CSS `@media (pointer: coarse)` đặt `font-size: 16px` cho `input`, `textarea`, `.ant-select` — không dùng `maximum-scale=1` để vẫn cho người dùng pinch-zoom.
- **Drawer mobile:** CSS ngoài layer (thắng `@layer antd`) trong `@media (max-width: 639px)`; nút footer `max-sm:flex-1`, nút "Huỷ" `max-sm:hidden`.
- **Bảng → thẻ:** `useIsMobile()` (`useSyncExternalStore` + `matchMedia("(max-width: 639px)")`, server snapshot = `hints.mobile` từ User-Agent qua `MobileHintContext`) → `DataTable` render `CardList` thay `Table` (chỉ render 1 trong 2). Thẻ dựng từ chính `columns` (`dataIndex` + `render`), nên không trang nào phải viết lại. Sort/filter cột không có ở chế độ thẻ.
- **theme-color:** `export const viewport` trong root layout với 2 media (light/dark) theo màu `--background`.

## Risks

- Cookie theme chỉ đúng sau lần đầu đặt; thiết bị đổi theme hệ thống trong lúc đóng app có thể nháy 1 lần.
- UA đoán sai (iPad giả desktop) → nhảy chiều cao control một lần sau hydrate.
