## 1. Primitives dùng chung

- [x] 1.1 `components/common/cells.tsx`: `DASH`, `StatusDot`, `DateTimeCell`; xoá `enum-tag.tsx`
- [x] 1.2 `user-avatar.tsx`: `staffLabel(s?)` → `DASH` khi trống; `staffOptions` (có `title` để tìm theo tên)
- [x] 1.3 `filter-controls.tsx`: `SearchInput`, `ClearFilters`
- [x] 1.4 `section.tsx`: `Section`
- [x] 1.5 `money-input.tsx` + `formatIdr` ở `lib/currency.ts`
- [x] 1.6 `FormDrawer` không `onSubmit` = chỉ xem
- [x] 1.7 `VisitStatusTag` / `BookingStatusTag` dùng `StatusDot`; "Đổi lịch" cùng màu

## 2. Áp dụng theo khu vực

- [x] 2.1 Khách hàng: customers / potential / bookings / pipeline / 360° / info + lịch sử lịch hẹn / Đến hạn / báo cáo SMAX
- [x] 2.2 Bán hàng: appointments / appointment-drawer / cards / tour / services
- [x] 2.3 Báo cáo + quản trị: reports / telesales / marketing / users / documents / reminders / notification / app-shell (sửa menu điện thoại)

## 3. Dọn dẹp + kiểm tra

- [x] 3.1 Xoá code chết (theme-toggle, icon-picker, LanguageSwitcher, TimePicker, appointment-photos)
- [x] 3.2 Xoá key i18n không còn dùng ở `messages/{vi,en}.json`
- [x] 3.3 `tsc --noEmit` + `eslint` + `node --test lib/*.test.ts` + `next build` sạch
- [x] 3.4 Ghi memory-bank
