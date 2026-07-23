# Tasks: add-enum-tag-icons

## 1. Database

- [x] 1.1 Migration `supabase/migrations/20260708090000_enum_options_icon_color.sql`: thêm cột `icon`/`color` (if not exists) + check constraint định dạng + seed màu mặc định cho stage/source (`where color is null`). Idempotent.
- [x] 1.2 Cập nhật `types/customer.ts`: `EnumOption` thêm `icon: string | null`, `color: string | null`.

## 2. Components chung

- [x] 2.1 `components/common/icon-picker.tsx`: Popover + search trên `iconNames` (lucide-react/dynamic), grid tối đa 96 kết quả + đếm x/y, chọn/bỏ chọn, render icon bằng `DynamicIcon`.
- [x] 2.2 `components/common/enum-tag.tsx`: render tag từ `{icon, color, label}` — text/icon = màu, nền hex+1A, viền hex+40; fallback Badge secondary khi không màu.

## 3. Trang /enums (admin)

- [x] 3.1 `app/(app)/enums/actions.ts`: `createOption`/`updateOption` nhận thêm `icon`, `color` (nullable).
- [x] 3.2 `components/enums/enums-manager.tsx`: dialog thêm IconPicker + chọn màu (12 swatch + input color + nút bỏ màu + xem trước tag); bảng thêm cột xem trước tag.

## 4. Trang /customers

- [x] 4.1 `components/customers/customers-manager.tsx`: cột Giai đoạn + Nguồn render `EnumTag` (tra option theo kind+value, nhãn theo locale).

## 5. i18n + kiểm chứng

- [x] 5.1 `messages/{vi,en,id}.json`: key mới cho enums (icon, màu, tìm icon, xem trước, bỏ chọn…).
- [x] 5.2 Kiểm chứng: `tsc --noEmit` sạch, `next build` PASS, eslint chỉ warning React Compiler về `watch()` (pattern có sẵn). Chưa test tay runtime (cần chạy migration + đăng nhập admin).
- [x] 5.3 Cập nhật `memory-bank/README.md` (mục nhật ký + trạng thái).
