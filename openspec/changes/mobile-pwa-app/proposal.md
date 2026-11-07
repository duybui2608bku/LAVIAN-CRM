## Why

Nhân viên (CSKH, KTV) dùng CRM chủ yếu trên điện thoại. Ba vấn đề hiện tại:
- Đăng xuất xong, hộp xác nhận "Đăng xuất" vẫn treo trên trang `/login` (nút OK quay loading mãi).
- Nhập liệu trên điện thoại khó chịu: kéo danh sách Select dài (khách hàng, dịch vụ, KTV…) bị giật lên xuống; chạm ô ngày bật bàn phím; ô số điện thoại hiện bàn phím chữ.
- Giao diện vẫn là web thu nhỏ (nút ☰ mở menu trượt) — không cài được lên màn hình chính như app, không có thanh tab dưới để chuyển trang bằng ngón cái.

## What Changes

- **Đăng xuất:** server action `signOut` chỉ huỷ phiên (không `redirect`); client tải lại cứng `/login` → modal, dropdown, cache React Query đều bị xoá sạch.
- **Nhập liệu cảm ứng (toàn app, không sửa từng trang):** thiết bị cảm ứng tắt virtual list của antd (cuộn native, có quán tính, không giật); danh sách dropdown `overscroll-behavior: contain` (kéo hết danh sách không kéo theo trang/drawer phía sau → dropdown không bị đặt lại vị trí); DatePicker/TimePicker không bật bàn phím trên cảm ứng (`inputReadOnly`); ô SĐT dùng bàn phím số (`inputMode="tel"`).
- **PWA kiểu app điện thoại:**
  - `app/manifest.ts` (tên, `display: standalone`, màu nền/theme, icon 192/512 + maskable) — cài được "Thêm vào màn hình chính" trên Android/iOS.
  - `appleWebApp` metadata, `viewportFit: cover` + padding `safe-area` (tai thỏ, thanh home).
  - Dưới `md`: thanh trên mỏng (logo + tên app), **thanh tab dưới** cố định: Khách hàng / Lịch hẹn / Tour / Menu. "Menu" mở bottom sheet chứa mục admin + tài khoản (giao diện tối, ngôn ngữ, đăng xuất). Bỏ nút ☰ + drawer trái.
  - Tinh chỉnh cảm giác app: bỏ highlight xanh khi chạm, `overscroll-behavior-y: none` trên body.

## Capabilities

### New Capabilities

- `mobile-pwa`: cài đặt như app, điều hướng bằng tab dưới, nhập liệu mượt trên cảm ứng, đăng xuất sạch.

## Impact

- Không đổi DB.
- Sửa `lib/actions/auth.ts`, `app/banned/page.tsx`, `components/layout/app-shell.tsx`, `components/common/{antd-provider,date-picker}.tsx`, `app/layout.tsx`, `app/globals.css`, ô SĐT ở form khách hàng.
- Thêm `app/manifest.ts`, `public/icons/*` (icon 192/512/maskable sinh từ `app/icon.png`).
- Không thêm service worker (không cần cho cài đặt; không làm offline).
