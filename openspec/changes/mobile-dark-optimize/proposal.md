## Why

Hầu hết kỹ thuật viên (KTV) nhận tour, điền chi tiết và chụp ảnh trên điện thoại, nhiều người dùng giao diện tối. Hiện tại: antd chỉ đọc theme sau khi mount nên mỗi lần tải trang ở dark mode bị nháy sáng; control antd cao 34px (nhỏ cho ngón tay); iOS tự phóng to khi chạm vào ô nhập (chữ < 16px); drawer chi tiết tour chật trên màn hình 375px; số tiền trong thẻ thống kê bị cắt.

## What Changes

- **Dark mode:** chống nháy sáng — lưu theme đã áp dụng vào cookie, layout đọc lại để antd render đúng theme ngay từ SSR. Thêm `color-scheme` theo theme (thanh cuộn, ô chọn file, date native tối) và `theme-color` (thanh trạng thái điện thoại cùng màu nền).
- **Mobile / cảm ứng:** thiết bị cảm ứng (`pointer: coarse`) dùng control cao 40px; ô nhập chữ 16px để iOS không tự zoom. SSR đoán thiết bị qua User-Agent để không nhảy layout.
- **Drawer (FormDrawer):** trên mobile padding gọn 16px, nút footer giãn đều cao 40px, ẩn nút "Huỷ" (đã có nút đóng ở header).
- **Trang Tour của KTV:** thẻ thống kê 2 cột, "Đã nhận" chiếm cả hàng (không cắt số tiền); nút xoá ảnh to hơn để dễ chạm.
- **StatCard:** chữ số `text-xl` trên mobile, `text-2xl` từ `sm`.
- **PageToolbar / PageHeader (mọi trang):** trên mobile mỗi ô lọc (select/input/date) 1 hàng full width, nút thao tác giãn đều.
- **DataTable (mọi bảng):** dưới 640px hiển thị dạng thẻ — mỗi dòng 1 thẻ "tên cột : giá trị", cột thao tác ở góc phải, bấm thẻ = bấm dòng; ô sửa nhanh vẫn dùng được.

## Capabilities

### New Capabilities

- `mobile-dark-ui`: yêu cầu hiển thị dark mode không nháy và thao tác cảm ứng trên điện thoại.

## Impact

- Không đổi DB.
- Sửa `app/layout.tsx`, `app/providers.tsx`, `app/globals.css`, `components/common/{antd-provider,form-drawer,stat-card}.tsx`, `components/layout/page.tsx`, `components/common/data-table.tsx`, `hooks/use-is-mobile.tsx`, `lib/ui-hints.ts`, `components/tour/{tour-view,photo-field}.tsx`.
