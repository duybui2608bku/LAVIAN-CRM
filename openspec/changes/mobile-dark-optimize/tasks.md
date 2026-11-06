## 1. Dark mode

- [x] 1.1 Cookie `theme-resolved` + `hints.dark` từ root layout → `AntdProvider` (chống nháy)
- [x] 1.2 `color-scheme` theo theme trong `globals.css`; `viewport.themeColor` light/dark

## 2. Mobile / cảm ứng

- [x] 2.1 `controlHeight` 40 khi `pointer: coarse` (SSR đoán qua User-Agent)
- [x] 2.2 Ô nhập 16px trên thiết bị cảm ứng (chống iOS zoom)
- [x] 2.3 FormDrawer mobile: padding 16px, nút footer giãn đều, ẩn "Huỷ"
- [x] 2.4 Tour KTV: thẻ thống kê 2 cột + "Đã nhận" full hàng; nút xoá ảnh to hơn
- [x] 2.5 StatCard: `text-xl sm:text-2xl`
- [x] 2.6 PageToolbar: mỗi control 1 hàng full width; nút PageHeader giãn đều trên mobile
- [x] 2.7 DataTable < 640px tự đổi sang danh sách thẻ (`useIsMobile`, SSR đoán qua User-Agent), cột `actions` lên góc thẻ, phân trang `simple`

## 3. Verification

- [x] 3.1 tsc/lint, xem thử mobile + dark trên preview (admin), ghi memory-bank
- [ ] 3.2 Thử thật trên điện thoại bằng tài khoản KTV (iOS + Android)
