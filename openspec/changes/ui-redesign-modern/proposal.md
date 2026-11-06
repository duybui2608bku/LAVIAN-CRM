## Why

User: "Thiết kế lại giao diện, xấu quá, UI UX không đồng bộ. Tham khảo các mẫu giao diện hiện đại, đồng bộ thiết kế, thao tác dễ hiểu, bỏ thừa không cần thiết."

Lệch nhau đo được trong code:

1. **Bảng mỗi trang một kiểu** — `/customers` size middle không viền; `/appointments`, `/tour` size small + `bordered`; `/services`, `/enums` `tableLayout=fixed`; phân trang chỗ có tổng, chỗ không; `/appointments` hiện số đếm ở toolbar thay vì ở phân trang.
2. **Thao tác trên dòng 3 kiểu** — `/customers` menu 3 chấm + modal xác nhận; `/services`, `/enums`, `/users` nút icon rời + Popconfirm; `/appointments` nút thùng rác rời + modal.
3. **Form tạo/sửa 2 kiểu** — `/customers`, `/appointments` dùng Drawer; `/services`, `/enums`, `/users` dùng Modal, nút footer khác chữ/thứ tự.
4. **Card số liệu 2 kiểu** — `Stat` ở `/tour` và card ở `/marketing` khác padding, cỡ chữ.
5. **Thừa / sai điều hướng** — mục menu "Báo cáo" trỏ `/` (redirect về `/customers` → 2 mục cùng sáng); "Danh mục" không có trong menu; header lặp tên app cạnh logo; toolbar `/customers` bày 7 select + khoảng ngày trên 1 hàng.
6. **Nhìn cũ** — bo góc 4px, header bảng nền xám đậm, nút nhảy lên khi hover.

## What Changes

Hướng thiết kế: phẳng, thoáng, mật độ vừa — kiểu Linear / Attio / Notion.

- **Token**: bo góc 8px (control 6px), header bảng chữ nhỏ màu phụ không nền đậm, hover dòng nhạt, bỏ hiệu ứng nút nhảy.
- **Khung app**: sidebar chứa logo + nút thu gọn, menu chia nhóm (Vận hành / Quản trị), khối tài khoản ở đáy (avatar, tên → menu: giao diện sáng/tối, ngôn ngữ, đăng xuất). Bỏ header trên desktop; mobile có thanh trên mỏng (nút menu + logo).
- **Menu**: bỏ "Báo cáo" (chưa có trang), thêm "Danh mục" (admin).
- **Component dùng chung mới** (`components/common/`):
  - `DataTable` — một cấu hình bảng duy nhất (surface, size, sticky header, cuộn ngang, phân trang có tổng).
  - `FormDrawer` — mọi form tạo/sửa bản ghi: Drawer phải, footer Huỷ / Lưu.
  - `StatCard` — một bố cục card số liệu.
- **Thao tác dòng**: mọi bảng dùng `RowActions` (3 chấm) + `useConfirm` (modal) cho thao tác nguy hiểm.
- **Bộ lọc `/customers`**: hiện tìm kiếm + Giai đoạn + Nguồn; các lọc còn lại vào nút "Bộ lọc" (popover, badge đếm) + nút "Xoá lọc".

## Impact

- Thêm: `components/common/{data-table,form-drawer,stat-card}.tsx`.
- Sửa: `app/globals.css`, `antd-provider.tsx`, `app-shell.tsx`, `page.tsx`, 6 manager + `tour-view`, `ads-stats`, `login/page.tsx`, `messages/{vi,en,id}.json`.
- **Không** migration DB, **không** thêm dependency, **không** đổi server action / dữ liệu.
