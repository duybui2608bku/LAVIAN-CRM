## 1. Đăng xuất

- [x] 1.1 `signOut` không redirect; AccountMenu tải lại cứng `/login` sau khi xong
- [x] 1.2 `/banned` dùng form action có redirect

## 2. Nhập liệu cảm ứng

- [x] 2.1 `ConfigProvider virtual={!touch}`
- [x] 2.2 `overscroll-behavior: contain` cho dropdown select/picker
- [x] 2.3 DatePicker không bật bàn phím trên cảm ứng
- [x] 2.4 Ô SĐT `inputMode="tel"`

## 3. PWA / giao diện app

- [x] 3.1 `app/manifest.ts` + icon 192/512/maskable
- [x] 3.2 `appleWebApp`, `viewportFit: cover`, safe-area
- [x] 3.3 Thanh tab dưới (< md) + bottom sheet Menu; bỏ ☰ + drawer trái
- [x] 3.4 Bỏ tap highlight, `overscroll-behavior-y: none`
- [x] 3.5 Mặc định light mode (không theo theme hệ thống)

## 4. Verification

- [x] 4.1 tsc/lint, preview 375px (dark, admin) + desktop, đăng xuất không còn modal
- [x] 4.2 Ghi memory-bank
- [x] 4.3 `proxy.ts` bỏ qua `/manifest.webmanifest` (trình duyệt tải manifest không kèm cookie)
- [ ] 4.4 Thử thật trên iPhone + Android: cài vào màn hình chính, vuốt select dài, đăng xuất
