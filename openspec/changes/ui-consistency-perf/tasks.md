## 1. Nền design system

- [x] 1.1 `app/globals.css`: xoá radial-gradient của `.app-workspace`; thêm `@utility surface`
- [x] 1.2 `components/layout/page.tsx`: `<Page>` + `<PageHeader title description actions>`
- [x] 1.3 `components/ui/textarea.tsx` (shadcn chuẩn)
- [x] 1.4 `components/common/row-actions.tsx`: tách `RowActions` ra khỏi customers-manager
- [x] 1.5 `date-picker.tsx`: thêm prop `size` cho `DatePicker`/`DateRangePicker` (mặc định `sm` = h-8)

## 2. Áp shell + surface cho mọi trang

- [x] 2.1 `app/(app)/page.tsx`, `marketing/page.tsx` → `<Page>`/`<PageHeader>`
- [x] 2.2 `customers-manager`, `appointments-manager`, `users-manager`, `enums-manager`, `services-manager` → `<Page>`/`<PageHeader>` + `surface`
- [x] 2.3 Xoá 3 hằng `fieldCls`, thay bằng `Textarea`/`Input`
- [x] 2.4 Thanh lọc: mọi control về `h-8`

## 3. De-AI dashboard

- [x] 3.1 Gộp `MetricCard` + `FinancialMetricCard` + card lịch hẹn về 1 component `StatCard`
- [x] 3.2 Bỏ `IconChip`, đổi `SectionTitle` sang chữ trần (không chip màu)
- [x] 3.3 Bỏ mọi `hover:shadow-md`; số `font-bold` → `font-semibold`
- [x] 3.4 Cỡ chữ tuỳ ý (`text-[10/11/13/15px]`) → thang Tailwind
- [x] 3.5 Màu cứng emerald/red/purple/neutral/amber → token dự án

## 4. Đồng nhất tương tác

- [x] 4.1 `/services` + `/enums`: `window.confirm()` → `AlertDialog`
- [x] 4.2 `/appointments`: thao tác phụ vào `RowActions`; phân trang 20 dòng

## 5. Độ trễ thao tác

- [x] 5.1 Xoá `router.refresh()` ở 23 chỗ đã có `revalidatePath` đúng route (giữ nút "Tải lại" thủ công)
- [x] 5.2 `enums/actions.ts`: `revalidatePath("/enums")` → `revalidatePath("/enums/[kind]", "page")`
- [x] 5.3 `loading.tsx` skeleton cho các route trong `app/(app)/`
- [x] 5.4 Inline edit dùng `useOptimistic` — không khoá cả bảng, lỗi thì rollback + toast

## 6. Kiểm chứng

- [x] 6.1 `npx tsc --noEmit` + `npm run lint` sạch (trừ 2 lỗi cũ `theme-toggle.tsx` / `use-mobile.ts`)
- [x] 6.2 `npm run build` chạy được
- [x] 6.3 Grep xác nhận: 0 `window.confirm`, 0 `text-[NNpx]`, 0 màu Tailwind cứng, 0 `hover:shadow`, 0 `router.refresh` thừa
- [x] 6.4 Cập nhật `memory-bank/README.md`
- [ ] 6.5 Soi thật `/customers` + `/appointments` sau đăng nhập: sửa inline, đổi trạng thái, xoá — CẦN tài khoản dev

## 7. Phát sinh khi kiểm chứng thật

- [x] 7.1 `leadForm.currencyPlaceholder` thiếu ở cả 3 locale — form công khai đang hiện thẳng chuỗi khoá. Đã thêm (`"0"`).
- [x] 7.2 `CurrencyInput` chép lại toàn bộ chuỗi class của `Input` (đã lệch: `bg-transparent`, `dark:bg-input/30`) — dựng lại trên `<Input>`.
- [x] 7.3 `Badge` cỡ `text-[13px]` → `text-xs`; thêm variant `info`/`success` thay 2 badge màu cứng.
- [x] 7.4 2 lỗi eslint `set-state-in-effect` (reset trang khi đổi bộ lọc) → điều chỉnh state trong render.
