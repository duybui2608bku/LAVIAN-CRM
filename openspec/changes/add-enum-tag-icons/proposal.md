# Proposal: add-enum-tag-icons

## Why

Giai đoạn (stage) và Nguồn (source) hiện hiển thị trong bảng khách hàng dưới dạng chữ thường / badge xám — khó quét mắt nhanh khi danh sách dài. Admin cần gắn **icon + màu** cho từng giá trị danh mục để chúng hiển thị thành tag trực quan, đồng thời dự án cần một **IconPicker tìm kiếm icon Lucide** tái sử dụng cho các tính năng sau này.

## What Changes

- Component chung `IconPicker`: popover tìm kiếm toàn bộ icon Lucide theo tên (dùng `lucide-react/dynamic` — `iconNames` + `DynamicIcon` lazy-load, không phình bundle), chọn/bỏ chọn icon, tái sử dụng được.
- Component chung `EnumTag`: render một option danh mục thành tag (icon + màu + nhãn theo locale).
- Migration DB: thêm cột `icon` (tên icon Lucide, nullable) và `color` (hex, nullable) vào `public.enum_options`, kèm seed màu mặc định cho stage/source.
- Trang `/enums` (admin): dialog thêm/sửa option có chọn icon (IconPicker) + chọn màu (swatch preset + màu tùy chỉnh); bảng hiện cột xem trước tag.
- Trang `/customers`: cột Giai đoạn và Nguồn hiển thị bằng `EnumTag` thay cho text/badge hiện tại (fallback badge thường khi option chưa cấu hình icon/màu).

## Capabilities

### New Capabilities
- `icon-picker`: component tìm kiếm & chọn icon Lucide dùng chung toàn dự án.

### Modified Capabilities
- `enum-management`: admin cấu hình thêm icon + màu tag cho từng option danh mục (chưa có spec chính — sẽ tạo delta spec trong change này).
- `customer-management`: bảng khách hàng hiển thị stage/source dưới dạng tag icon + màu (chưa có spec chính — delta spec trong change này).

## Impact

- **DB:** `supabase/migrations/` thêm 1 file (alter `enum_options` + seed màu). Idempotent, chạy tay trong SQL Editor.
- **Types:** `types/customer.ts` (`EnumOption` thêm `icon`, `color`).
- **Server actions:** `app/(app)/enums/actions.ts` (create/update nhận thêm `icon`, `color`).
- **UI:** thêm `components/common/icon-picker.tsx`, `components/common/enum-tag.tsx`; sửa `components/enums/enums-manager.tsx`, `components/customers/customers-manager.tsx`.
- **i18n:** thêm key namespace `enums` (icon/màu/tìm icon) cho `messages/{vi,en,id}.json`.
- **Dependency:** không thêm mới — `lucide-react` đã cài sẵn (`/dynamic` có sẵn trong v1.23).
