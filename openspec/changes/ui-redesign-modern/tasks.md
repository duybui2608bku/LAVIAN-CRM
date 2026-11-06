## 1. Nền

- [x] 1.1 Token: `globals.css` + `antd-provider.tsx` (bo 8px, bảng, menu, bỏ nút nhảy)
- [x] 1.2 `DataTable`, `FormDrawer`, `StatCard` trong `components/common/`
- [x] 1.3 `PageHeader` thêm `description`

## 2. Khung app

- [x] 2.1 `app-shell.tsx`: sidebar nhóm menu + khối tài khoản ở đáy; bỏ header desktop; mobile top bar
- [x] 2.2 Menu: bỏ "Báo cáo", thêm "Danh mục"

## 3. Các trang

- [x] 3.1 `/customers`: DataTable, bộ lọc gọn (popover "Bộ lọc" + "Xoá lọc"), FormDrawer
- [x] 3.2 `/appointments`: DataTable, RowActions
- [x] 3.3 `/services`, `/enums`: DataTable, RowActions, FormDrawer
- [x] 3.4 `/users`: DataTable, RowActions, FormDrawer cho tạo user
- [x] 3.5 `/tour`, `/marketing`: DataTable + StatCard
- [x] 3.6 `/login`: nền + card theo token mới

## 4. Kiểm chứng

- [x] 4.1 `npx tsc --noEmit` + `npm run lint`
- [x] 4.2 Xem từng trang trên trình duyệt (sáng/tối, mobile)
