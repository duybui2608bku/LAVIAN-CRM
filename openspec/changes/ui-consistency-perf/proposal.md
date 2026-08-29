## Why

User: "Fix toàn bộ giao diện đồng nhất, chung 1 pattern design, và tôi thấy web giao diện nhìn AI quá, các actions thì giật lag".

Ba vấn đề đo được trong code hiện tại:

1. **Không đồng nhất** — 3 bản `fieldCls` khác nhau (`py-1` vs `py-1.5`, có/không `h-8`) ở 3 file; tiêu đề trang 3 kiểu (`text-2xl font-bold` / `text-2xl font-semibold` / `text-xl font-semibold`); thanh lọc lệch chiều cao (Input `h-8`, SelectTrigger `h-8`, DateRangePicker `h-9`); `/services` + `/enums` xoá bằng `window.confirm()` native còn chỗ khác dùng `AlertDialog`; chuỗi `rounded-xl border bg-card shadow-xs` lặp 12 chỗ.
2. **Nhìn "AI"** — dashboard có 2 layout card khác nhau cho cùng một loại số liệu; mỗi card gắn 1 chip icon pastel 5 màu thuần trang trí; `hover:shadow-md` nhấc bóng trên card KHÔNG bấm được; vệt radial-gradient tím trên nền workspace; cỡ chữ lệch thang (`text-[10px]`, `text-[11px]`, `text-[13px]`, `text-[15px]`); màu cứng `emerald-600`/`red-600`/`purple-100` thay vì token.
3. **Giật lag** — không có `loading.tsx` nào nên điều hướng đứng hình cho tới khi query server xong; mỗi action gọi server **2 lần** (`revalidatePath` trong action đã trả payload mới, client lại `router.refresh()` — 23 chỗ); `revalidatePath("/enums")` trỏ trang redirect nên không revalidate `/enums/[kind]`; 1 `useTransition` dùng chung khoá xám cả bảng khi sửa 1 ô; `/appointments` render toàn bộ dòng không phân trang.

## What Changes

**Design system (hướng "dày đặc, phẳng" — Linear/Attio):**
- `app/globals.css`: bỏ radial-gradient của `.app-workspace`; thêm `@utility surface` (viền tóc + `bg-card`, KHÔNG bóng) thay 12 chỗ lặp.
- `components/layout/page.tsx` mới: `<Page>` + `<PageHeader title description actions>` — 1 shell duy nhất cho 7 trang. Tiêu đề chốt `text-xl font-semibold tracking-tight`.
- `components/ui/textarea.tsx` mới (shadcn chuẩn) → xoá 3 hằng `fieldCls`.
- Thanh lọc: mọi control về `h-8` (thêm prop `size` cho DatePicker/DateRangePicker).
- Dashboard: gộp `MetricCard` + `FinancialMetricCard` + card lịch hẹn về **1** component; bỏ `IconChip` trang trí và `SectionTitle` có chip màu; bỏ `hover:shadow-md`; số dùng `font-semibold` thay `font-bold`; cỡ chữ về thang Tailwind.
- Màu cứng → token: `emerald`→`--success`, `red`→`--destructive`, `purple` (badge khách cũ) → `--info`.
- `/services` + `/enums`: `window.confirm()` → `AlertDialog` như phần còn lại.
- `RowActions` (menu 3 chấm) chuyển sang `components/common/` và dùng chung cho `/appointments`.

**Độ trễ thao tác:**
- Xoá `router.refresh()` ở mọi chỗ mà server action đã `revalidatePath` đúng route → 1 round-trip thay vì 2.
- `revalidatePath("/enums")` → `revalidatePath("/enums/[kind]", "page")`.
- Thêm `loading.tsx` (skeleton) cho các route trong `app/(app)/`.
- Inline edit dùng `useOptimistic`: ô đổi ngay, không khoá cả bảng.
- `/appointments`: phân trang 20 dòng như `/customers`.

## Capabilities

### New Capabilities
- `ui-design-system`: một pattern layout/typography/surface/control duy nhất cho toàn app.
- `action-latency`: hợp đồng về số round-trip và phản hồi tức thì của thao tác ghi.

## Impact

- Thêm: `components/layout/page.tsx`, `components/ui/textarea.tsx`, `components/common/row-actions.tsx`, `app/(app)/**/loading.tsx`.
- Sửa: `app/globals.css`, 7 trang, 6 manager, `marketing-stats.tsx`, 5 file `actions.ts`, `date-picker.tsx`, `messages/{vi,en,id}.json`.
- **Không** migration DB, **không** thêm dependency, **không** đổi API/hợp đồng dữ liệu.
