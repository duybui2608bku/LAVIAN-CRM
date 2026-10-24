## Why

User: "THAY THẾ THƯ VIỆN UI LÀ ANT LÀM UI UX CLEAN CODE SẠCH, TẠO COMPONENTS DÙNG CHUNG NẾU CẦN THIẾT".

UI hiện dựng trên shadcn/ui (Radix + Tailwind + cva) — mỗi primitive là 1 file copy trong `components/ui/` (≈2.300 dòng tự bảo trì: sidebar 700 dòng, select, dialog, calendar…), form tự ráp Label + Input + message lỗi bằng tay ở từng manager. Chuyển sang **Ant Design 6** để dùng bộ component hoàn chỉnh (Table phân trang, Form validate, Modal/Drawer, DatePicker, Select multiple, Dropdown, Popconfirm, Layout/Menu) và xoá code primitive tự viết.

## What Changes

- **BREAKING (nội bộ):** xoá toàn bộ `components/ui/*`; gỡ `radix-ui`, `shadcn`, `class-variance-authority`, `tw-animate-css`, `sonner`, `react-day-picker`, `react-hook-form`, `@hookform/resolvers`.
- Thêm `antd@6`, `@ant-design/nextjs-registry` (SSR CSS-in-JS cho App Router), `dayjs` (dependency của antd DatePicker).
- `app/layout.tsx`: bọc `AntdRegistry layer` → style antd nằm trong `@layer antd` (thứ tự `theme, base, antd, components, utilities`) để Tailwind utility (chỉ dùng cho layout) vẫn ghi đè được khi cần, preflight không đè antd.
- `components/common/antd-provider.tsx`: `ConfigProvider` — theme token lấy từ bảng màu dự án (primary `#684fd4`, radius 4, font Inter, control height 32), `darkAlgorithm` theo `next-themes`, locale antd + dayjs theo locale next-intl (vi/en/id); bọc `<App>` để message/modal ăn theme.
- `lib/toast.ts`: API `toast.success/error/info/warning` giữ nguyên chữ ký cũ, chạy trên `App.useApp().message` (bridge) — call site không đổi.
- Component dùng chung (giữ API cũ, ruột antd): `ClearableSelect`, `MultiSelect`, `DatePicker`/`DateRangePicker` (chuỗi `YYYY-MM-DD`), `CurrencyInput`, `IconPicker`, `ImageUpload`, `EnumTag`, `RowActions` (Dropdown), `UserAvatar` (Avatar), `LanguageSwitcher`, `ThemeToggle`, `ErrorState` (Result), `ConfirmAction` (Popconfirm — thay mọi AlertDialog xác nhận).
- Shell: `Layout` + `Layout.Sider` (thu gọn, nhớ cookie `sidebar_state`) + `Menu` (mục con Danh mục) + header; `Page/PageHeader/PageToolbar` giữ API.
- Form: dùng `antd Form` + `rules` thay react-hook-form/zod phía client (server action vẫn validate như cũ).
- Bảng: `antd Table` (pagination 20 dòng có sẵn) thay table tự dựng + phân trang tay.
- Form dài (khách hàng, đặt lịch): `Drawer` phải; form ngắn: `Modal`.

## Capabilities

### Modified Capabilities
- `ui-design-system`: nền component đổi từ shadcn sang Ant Design; quy ước shell/trang giữ nguyên.

## Impact

- Sửa toàn bộ file trong `components/**`, `app/**/page.tsx` dùng UI, `app/layout.tsx`, `app/providers.tsx`, `app/globals.css`, `package.json`.
- **Không** migration DB, **không** đổi server action / API / hợp đồng dữ liệu.
