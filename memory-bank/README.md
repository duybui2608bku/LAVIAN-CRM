# Memory Bank — LAVIAN-CRM

Nơi ghi lại thay đổi của dự án qua từng session làm việc với AI.
Mục tiêu: một session mới chỉ cần đọc file này là biết dự án đã cập nhật gì và còn việc gì dở.

## Cách dùng
- **Bắt đầu session:** đọc từ trên xuống — mục "Trạng thái hiện tại" + mục nhật ký mới nhất.
- **Kết thúc session:** thêm 1 mục mới vào đầu phần "Nhật ký session" (mới nhất ở trên cùng), rồi cập nhật lại "Trạng thái hiện tại" nếu cần.

## Định dạng mỗi mục nhật ký
Tiêu đề: `### YYYY-MM-DD — <tiêu đề ngắn>` — kèm 3 gạch đầu dòng:
- **Thay đổi:** làm gì
- **File ảnh hưởng:** đường dẫn các file
- **Còn dở / ghi chú:** việc chưa xong, cần lưu ý

## Trạng thái hiện tại
- Dự án **Next.js 16** (breaking changes — đọc `node_modules/next/dist/docs/` trước khi code, xem `AGENTS.md`). App Router, thư mục `app/` ở root (không dùng `src/`), alias `@/*` = root.
- **Breaking change đã áp dụng:** Middleware → **Proxy** (`proxy.ts` ở root, không phải `middleware.ts`); `cookies()` là **async**.
- Stack đã cấu hình xong: Tailwind v4 + shadcn/ui (style `radix-nova`, icon Lucide) **đã kế thừa design token ClickUp** (globals.css — primary tím `#7b68ee`, radius 8px, có token success/warning/info/priority sáng+tối), toast **sonner** (`components/ui/sonner.tsx`, mount ở providers), React Query (Provider ở `app/providers.tsx`), Zustand (đã cài, chưa tạo store), react-hook-form + zod, Supabase SSR (client/server + proxy refresh session).
- **Supabase:** dùng **publishable key** (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), KHÔNG dùng anon/service_role ở client. Env điền ở `.env.local`.
- Quy trình bắt buộc khi code/fix bug: openspec → ui-ux-pro-max → supabase → ponytail (xem `CLAUDE.md`).
- **i18n:** `next-intl` chế độ cookie (`NEXT_LOCALE`), URL **không đổi**, KHÔNG dùng `[lang]` segment. 3 locale `en`/`vi`/`id`, mặc định `vi`. Config ở `i18n/config.ts` + `i18n/request.ts`; bản dịch ở `messages/{locale}.json`; đổi ngôn ngữ qua Server Action `i18n/actions.ts`.
- **Xử lý lỗi:** dùng chung `lib/errors` — `AppError` + `normalizeError()` (gom Axios/Supabase/Zod/generic). Axios instance ở `lib/api/client.ts` đã cắm interceptor normalize. Trang lỗi: `app/{not-found,error,global-error}.tsx` (Next 16 dùng `unstable_retry`, KHÔNG phải `reset`).
- **Cấu trúc thư mục:** `i18n/`, `messages/`, `types/`, `lib/api/`, `lib/errors/`, `components/common/`, `components/layout/`, `hooks/` (đã có `lib/supabase/`, `components/ui/`).
- **Layout shell:** Header + Sidebar thu gọn dựng bằng shadcn `sidebar`, đặt trong route group `app/(app)/`. Mọi trang trong shell đặt dưới `app/(app)/`. Không footer. Logo ở `components/layout/logo.tsx`.
- **Dark mode:** đã bật — `next-themes` (class strategy, `defaultTheme="system"`), `ThemeProvider` ở `app/providers.tsx`, `<html suppressHydrationWarning>`, nút `ThemeToggle` ở header. Token `.dark` sẵn trong `globals.css`; `sonner` bám theme.
- **Đổi ngôn ngữ:** `components/common/language-switcher.tsx` dùng **shadcn Select** + cờ SVG nội tuyến (không native `<select>` nữa). Vì đổi locale chạy `revalidatePath("/","layout")` (re-render toàn bộ, khá lâu) nên switcher **chủ động chạy top-loader** qua `useTopLoader()` trong lúc pending.
- **Loading điều hướng:** `nextjs-toploader` — `<NextTopLoader color="var(--primary)" height={2} showSpinner={false} />` mount ở `app/layout.tsx`, tự hiện thanh tiến trình khi click `<Link>`/đổi trang.
- **Cursor:** rule base ở `globals.css` trả lại `cursor:pointer` cho `button`/`[role=button]` (Tailwind v4 preflight bỏ mặc định).
- **Auth + Quản lý user (tính năng nghiệp vụ đầu tiên):** bảng `public.profiles` (role `admin`|`user`, status `active`|`banned`, KHÔNG lưu mật khẩu) ánh xạ `auth.users`. Đăng nhập `/login`, đăng xuất (header), trang `/banned`. `proxy.ts` là **cổng bảo vệ** (chưa-login → `/login`; banned → `/banned`; `/users` chỉ admin). Trang admin `/users`: tạo/cấm/bỏ cấm/đặt lại mật khẩu/tìm kiếm qua **Server Action + `SUPABASE_SECRET_KEY`** (server-only, `lib/supabase/admin.ts`). User KHÔNG tự đăng ký — admin tạo. Admin helper: `lib/auth.ts` (`getCurrentProfile`, `requireAdmin`).
- **Migration DB:** đặt ở `supabase/migrations/*.sql`, **chạy tay** trong Supabase SQL Editor. Quy tắc mới **CLAUDE.md §4**: mọi thay đổi DB phải kèm file migration idempotent.
- **Storage:** bucket public **`images`** (5MB, chỉ ảnh) — đọc công khai qua public URL, upload theo thư mục `{user_id}/`, RLS chặn ghi ngoài thư mục mình. Helper `lib/supabase/storage.ts` (`uploadImage`/`removeImage`) + component `components/common/image-upload.tsx` (`<ImageUpload value onChange folder label>`).
- **Danh mục Enum (admin):** bảng `public.enum_options` (kind ∈ stage/source/lost_reason, value + label_vi bắt buộc, label_en/label_id **không bắt buộc** (null → UI fallback tiếng Việt, bảng hiện "—"), **icon + color** cho tag, sort_order, is_active) thay cho Postgres enum — admin CRUD **tách trang con theo kind**: `/enums/[kind]` (validate `ENUM_KINDS` → notFound; `/enums` redirect `/enums/stage`); sidebar "Danh mục" = menu cha (Link `/enums/stage`) + 3 `SidebarMenuSub` con (sub tự ẩn khi thu gọn icon, KHÔNG dùng collapsible). `EnumsManager` nhận prop `kind`, render 1 kind/trang (chọn icon qua IconPicker, màu qua swatch/`input color`, có xem trước tag). Seed sẵn đủ giá trị mặc định + màu & icon mặc định cho cả 3 kind. `types/customer.ts` (`ENUM_KINDS` const + `EnumOption`). Customers lưu **giá trị text** của stage/source/lost_reason (không FK); nhãn tra theo locale bằng `lib/customers.ts` (`optionLabel`); bảng /customers hiển thị stage/source bằng `EnumTag`.
- **Dịch vụ (admin `/services`):** bảng `public.services` (name_vi bắt buộc, name_en/name_id **không bắt buộc** — null, bảng hiện "—"; sort_order, is_active, trigger updated_at dùng chung; RLS đọc-authenticated/ghi-admin giống enum_options; **chưa có giá/mô tả** — thêm cột khi cần). CRUD ở `/services` (`ServicesManager` copy pattern EnumsManager rút gọn: bảng 3 tên + toggle kích hoạt + dialog thêm/sửa + xóa cứng `window.confirm`; `deleteService` **chặn xóa khi còn dòng nối `customer_services`** — đếm mọi dòng khớp FK restrict). Gác admin: `proxy.ts` (`/services`) + `requireAdmin()`. `types/service.ts`; i18n namespace `services` + `nav.services`.
- **Dịch vụ ↔ Khách hàng:** bảng nối `public.customer_services` (PK kép, FK cascade/restrict, RLS authenticated toàn quyền). `/customers`: cột "Dịch vụ" = **multi-select inline** (`InlineServices` — trigger là badge, lưu 1 lần khi đóng popover nếu đổi, qua `patchCustomer` whitelist `service_ids`), bộ lọc 1 dịch vụ (client-side `CustomerFilters.serviceId`), dialog gắn dịch vụ bằng **`MultiSelect`** (RHF Controller `service_ids`); ghi bằng `syncServices` delete-all-insert. Component dùng chung `components/common/multi-select.tsx` (Popover toggle + check, trigger style SelectTrigger, children thay nội dung trigger). Helper `serviceName` ở `lib/customers.ts`.
- **Lịch hẹn (`/appointments`, mọi user):** 3 bảng `appointments` (scheduled_at **nullable** = cọc chưa chốt ngày; status hardcode check constraint `pending_confirmation|booked|checked_in|completed|no_show|cancelled` — KHÔNG vào enum_options; tiền nội bộ expected/deposit/final + payment_method bank|cash|card; Sisa = tính, không lưu; soft-delete) + `appointment_services` (bảng nối, FK service **restrict**) + `appointment_status_history` (**trigger** `log_appointment_status` security definer tự ghi khi status đổi — audit, chỉ grant select/insert). Trang `/appointments`: tab **Trong ngày** (lọc ngày LOCAL — `localDay` trong `lib/appointments.ts`, nhóm row theo trạng thái, dòng tổng doanh thu ngày) + tab **Chờ xếp lịch** (`scheduled_at is null`, thay sheet DP CUS); action nhanh theo status: check-in / hoàn tất (popover nhập Paid + phương thức) / dời lịch (popover DatePicker+giờ) / no-show / hủy / đặt lại lịch. **Status transition chỉ qua server action** `setAppointmentStatus`/`rescheduleAppointment` (stamp mốc `*_at`); tạo mới: có ngày → `booked`, không → `pending_confirmation`; pending chốt ngày → tự chuyển booked. **Nâng `customer.stage` chỉ đi TIẾN** (so `sort_order` enum stage): booked→booked, check-in/hoàn tất→visited, cọc chờ ngày→deposited. `/customers`: nút **Đặt lịch** (AppointmentDialog `customerLock`) + nút lịch sử lịch hẹn (badge đếm). Component: `appointment-dialog.tsx` (dùng chung 2 trang), `status-tag.tsx` (STATUS_META màu/icon hardcode), `components/common/user-avatar.tsx` (tách từ customers-manager). `deleteService` chặn thêm khi còn `appointment_services`. Types `types/appointment.ts`; helper + test `lib/appointments{,.test}.ts`. **Calendar view tuần/tháng:** toggle icon bảng↔lịch ở header (`view: table|week|month`, `day` kiêm ngày neo); `appointments-calendar.tsx` tự dựng CSS grid (KHÔNG lib calendar): tuần = cột giờ 08–20h tự nới + card absolute theo giờ/`duration_minutes`, chồng giờ chia lane (`assignLanes` greedy trong lib/appointments); tháng = ô ngày ≤3 chip + "+n"; card màu `STATUS_META` pattern `--tag`; click card → dialog sửa, click ngày/"+n" → về bảng đúng ngày; calendar chỉ lọc search/staff/service (ẩn tab + DatePicker + lọc status).
- **Icon Lucide:** component dùng chung `components/common/icon-picker.tsx` (search toàn bộ icon qua `lucide-react/dynamic` — `iconNames` + `DynamicIcon` lazy-load, KHÔNG import tĩnh cả bộ icon) và `components/common/enum-tag.tsx` (tag từ 1 hex qua CSS var `--tag`: light chữ = màu/nền 10%/viền 25%; dark chữ pha sáng `color-mix` 65%+white, nền 20%/viền 40%). **Size mọi tag lấy từ base Badge** (`components/ui/badge.tsx`: h-6, text-[13px], icon 3.5) — muốn chỉnh to/nhỏ sửa 1 chỗ đó.
- **Form drawer:** 2 form dài (tạo/sửa khách hàng, đặt lịch hẹn) dùng **Sheet trượt từ phải** (không phải Dialog): thân cuộn, footer dính đáy, nút submit nối form qua `form` id, **mỗi field 1 hàng** (`grid gap-3` 1 cột, không còn `grid-cols-2`). Đặt lịch TẠO MỚI tự prefill Nguồn/Dịch vụ/Nhân viên từ hồ sơ khách (`CustomerRef` có optional `source`/`staff_id`/`service_ids`); sửa lịch không prefill lại.
- **Khách hàng (mọi user):** bảng `public.customers` (identity full_name/phone/social_link; phân loại source/stage/lost_reason/staff_id; first_contact; `notes` jsonb `[{text,at}]`; system created/updated/deleted_at soft-delete). Trang `/customers` CRUD + lọc (stage/source/staff/khoảng ngày created_at) + tìm (tên/phone), lọc **client-side** (`matchesCustomerFilters`). **KHÔNG unique** (cho phép trùng, kể cả phone) — chỉ index thường. RLS: mọi authenticated toàn quyền customers; **thêm policy `profiles_select_authenticated`** để user đọc tên nhân viên. Dropdown/lọc dùng **shadcn Select**; ngày dùng **shadcn date picker** (`components/common/date-picker.tsx`: `DatePicker` đơn + `DateRangePicker` range) trên nền `react-day-picker`+`date-fns`; bộ lọc ngày = 1 **date range**; có nút **Tải lại**. Stage/Source/Staff **sửa inline ngay trên bảng** (`InlineSelect` + action `patchCustomer`); xóa dùng **AlertDialog** xác nhận; dialog tạo/sửa KHÔNG chứa ghi chú (ghi chú chỉ qua cột Ghi chú: QuickNote + lịch sử). Cột Nhân viên + lịch sử ghi chú hiện **avatar user** (`UserAvatar` nội bộ, fallback `avt.webp`; note tra avatar theo tên snapshot `by`). `/enums` gác admin trong `proxy.ts`.
- **Form public `/lead-form` (nhúng SMAX):** trang ngoài `(app)`, không cần đăng nhập (proxy: `PUBLIC_PATHS` tách khỏi `AUTH_PAGES`); submit → server action `submitLead` ghi customers bằng **admin client** (stage `new_lead`, source `smax`/`?source=`, note `by:"Form SMAX"`, first_contact giờ VN); tích hợp SMAX postMessage (`__SM_FORM_CUSTOMER` prefill, `__SM_FORM_POPUP` HIDE) chỉ khi trong iframe; honeypot chống bot; seed source `smax` ở migration `20260714090000`.

## Nhật ký session

### 2026-07-14 — Form public /lead-form nhúng SMAX → tạo khách hàng
- **Thay đổi:**
  - **OpenSpec:** `openspec/changes/public-lead-form-smax/` (proposal/design/specs/tasks, 5/5 done, validate PASS) — **chưa archive**. Theo tài liệu tailieu.smax.ai (Nhúng form: iframe public URL + `postMessage`).
  - **Trang public `/lead-form`** (ngoài `(app)`, không cần đăng nhập, nhúng iframe SMAX được): card giữa trang + Logo (pattern /login), form 3 field mỗi field 1 hàng (họ tên*, SĐT*, ghi chú) + honeypot ẩn `website`; màn hình cảm ơn có nút "Gửi thông tin khác" + nút "Đóng" (chỉ khi nhúng). `useSearchParams` bọc Suspense.
  - **Tích hợp SMAX** (`components/lead-form/lead-form.tsx`, chỉ chạy khi `window.parent !== window`): mount → postMessage `__SM_FORM_CUSTOMER` (integration_id từ `?integration_id=`); nhận event → prefill tên/SĐT vào ô còn TRỐNG + giữ `{id,name}` khách SMAX; nút Đóng → `__SM_FORM_POPUP` action HIDE. Lưu ý React Compiler eslint: KHÔNG setState sync trong effect (embedded = lazy `useState` initializer) và KHÔNG đọc ref trong closure render (smax = state, set trong message callback).
  - **Server action `submitLead`** (`app/lead-form/actions.ts`): anonymous nên ghi bằng **admin client** (RLS customers chỉ cho authenticated; KHÔNG mở RLS anon) — zod validate lại toàn bộ (trust boundary), honeypot có giá trị → success giả không insert; insert stage `new_lead`, source mặc định `smax` (override `?source=` phải khớp `^[a-z0-9_]{1,50}$`), `first_contact` theo Asia/Ho_Chi_Minh (`toLocaleDateString("en-CA")` — tránh lệch ngày UTC), notes append dấu vết `Từ SMAX: {name} (id ...)` + ghi chú khách, `by: "Form SMAX"`.
  - **proxy.ts:** tách `AUTH_PAGES` (login/banned — đã đăng nhập đá về `/`) khỏi `PUBLIC_PATHS` (thêm `/lead-form` — ai cũng vào được, KHÔNG redirect người đã đăng nhập).
  - **DB:** `supabase/migrations/20260714090000_seed_source_smax.sql` — seed enum_options `('source','smax')` label SMAX, icon `message-square`, màu `#0084ff`, sort 45, `on conflict do nothing`.
  - **i18n:** namespace `leadForm` (16 key) × 3 locale.
  - **Kiểm chứng:** `tsc --noEmit` sạch; eslint file sửa sạch; `next build` PASS (route `/lead-form` dynamic); **test runtime bằng `next start`**: GET `/lead-form` 200 anonymous đúng nội dung, `/customers` vẫn 307 → /login; insert payload thật vào customers bằng admin key OK (dòng test đã xóa ngay).
- **File ảnh hưởng:** thêm `app/lead-form/{page.tsx,actions.ts}`, `components/lead-form/lead-form.tsx`, `supabase/migrations/20260714090000_seed_source_smax.sql`, `openspec/changes/public-lead-form-smax/*`; sửa `proxy.ts`, `messages/{vi,en,id}.json`.
- **Còn dở / ghi chú:**
  - ⚠️ **Chạy migration** `20260714090000_seed_source_smax.sql` trong Supabase SQL Editor (sau 20260708090000) — chưa chạy thì khách mới vẫn tạo được, badge nguồn hiện giá trị thô "smax".
  - **Cấu hình phía SMAX:** Cài đặt → Tích hợp → nền tảng "Nhúng form" → dán URL `https://<domain>/lead-form` (thêm `?source=<value>` nếu muốn nguồn khác). Chưa test trong iframe SMAX thật (cần deploy + tài khoản SMAX) — phần postMessage viết đúng theo docs, form vẫn dùng được như form thường nếu SMAX im lặng.
  - Bỏ qua (YAGNI, đã ghi design): rate-limit server (honeypot là đủ, nâng khi bị spam), dedupe theo phone (CRM cho phép trùng), chọn dịch vụ/nhân viên trên form.
  - Chưa archive 10 openspec change (thêm `public-lead-form-smax`).

### 2026-07-10 — Calendar view tuần/tháng cho /appointments
- **Thay đổi:**
  - **OpenSpec:** `openspec/changes/appointments-calendar-view/` (proposal/design/specs/tasks, 8/8 done, validate PASS) — **chưa archive**. KHÔNG migration DB, không dependency mới.
  - **Helper (`lib/appointments.ts`):** `groupByDay` (gom lịch theo ngày local, bỏ `scheduled_at null`, sắp theo giờ), `assignLanes` (xếp lane greedy cho lịch chồng giờ — cụm giao nhau chia đều bề rộng), `localTime` (chuyển từ const nội bộ appointments-manager ra lib để calendar dùng chung). +4 test mới → 10/10 PASS.
  - **Component mới `components/appointments/appointments-calendar.tsx`:** tự dựng bằng CSS grid + date-fns có sẵn (loại FullCalendar/react-big-calendar — nặng, lệch theme). Tuần: header 7 ngày (T2–CN, `weekStartsOn: 1`) + cột giờ 08–20h tự nới theo lịch, card absolute (top theo giờ, height theo duration, min 20px, left/width theo lane), hôm nay nền accent. Tháng: lưới phủ đủ tháng, ô ngày ≤3 chip + nút "+n", ngày ngoài tháng muted, số ngày hôm nay bg-primary tròn. Card/chip màu `STATUS_META[status].color` theo pattern CSS var `--tag` của EnumTag (light nền 15%, dark 25% + chữ color-mix), title tooltip giờ+tên; click card → `onPick` (dialog sửa), click số ngày/"+n" → `onPickDay`.
  - **AppointmentsManager:** state `view: "table" | "week" | "month"` (`day` sẵn có kiêm ngày neo calendar — đổi view không mất ngữ cảnh); segmented icon List/CalendarDays cạnh nút Tải lại; ở calendar: segmented Tuần/Tháng + nút ‹/Hôm nay/› + nhãn khoảng thời gian (`toLocaleDateString`), ẩn tab Trong ngày/Chờ xếp lịch + DatePicker + lọc status (search/staff/service giữ, lọc qua `calendarList` — KHÔNG lọc ngày); `onPickDay` → set day + tab day + về bảng; dòng tổng doanh thu chỉ hiện ở bảng.
  - **i18n:** +8 key namespace `appointments` (viewTable, viewCalendar, week, month, today, prev, next, more `{count}`) × 3 locale.
  - **Kiểm chứng:** `node --test lib/appointments.test.ts` 10/10 PASS; `tsc --noEmit` sạch; eslint file sửa sạch; `next build` PASS.
- **File ảnh hưởng:** thêm `components/appointments/appointments-calendar.tsx`, `openspec/changes/appointments-calendar-view/*`; sửa `components/appointments/appointments-manager.tsx`, `lib/appointments.ts`, `lib/appointments.test.ts`, `messages/{vi,en,id}.json`.
- **Còn dở / ghi chú:**
  - Chưa test tay runtime (cần migration appointments + đăng nhập) — mới verify test/tsc/build.
  - Bỏ qua (YAGNI, đã ghi design): kéo-thả dời lịch, click ô trống tạo lịch, day-view calendar (bảng Trong ngày đã phủ), lịch `scheduled_at null` không lên calendar (vẫn ở tab Chờ xếp lịch).
  - Chưa archive 9 openspec change (thêm `appointments-calendar-view`).

### 2026-07-10 — Form drawer bên phải + prefill thông tin khách khi đặt lịch
- **Thay đổi:**
  - **OpenSpec:** `openspec/changes/drawer-forms-booking-prefill/` (proposal/design/specs/tasks, 7/7 done, validate PASS) — **chưa archive**. KHÔNG migration DB.
  - **Drawer:** 2 form dài (CustomerDialog trong `customers-manager.tsx`, `appointment-dialog.tsx`) chuyển `Dialog` → **`Sheet` phải** (`components/ui/sheet.tsx` có sẵn): `SheetContent className="w-full gap-0 sm:max-w-xl"`, thân form `min-h-0 flex-1 overflow-y-auto px-4 pb-4`, **footer nằm NGOÀI form** dính đáy (`SheetFooter flex-row justify-end border-t`, nút submit nối qua `form="customer-form"`/`form="appointment-form"` — tránh re-indent field). Dialog nhỏ (lịch sử ghi chú/lịch hẹn, AlertDialog xóa) giữ nguyên.
  - **Prefill đặt lịch (CHỈ khi tạo mới, sửa giữ nguyên dữ liệu lịch):** `CustomerRef` nới thêm optional `source`/`staff_id`/`service_ids` (customers-manager truyền full Customer tự khớp); initial `values` ưu tiên `editing` → `customerLock` cho 3 trường source/staff_id/service_ids; đổi khách trong select → `setValue` 3 trường theo khách vừa chọn (khách thiếu → set rỗng; service_ids lọc theo option đang hiển thị); filter `serviceOpts` bao id đang gắn của editing/customerLock. Chọn setValue thay vì values-reset để không mất tiền/ghi chú đang gõ.
  - **Query:** `/appointments/page.tsx` customers select thêm `source, staff_id, customer_services(service_id)` → map `service_ids` (pattern map nested sẵn có).
  - Yêu cầu "chọn nhiều dịch vụ cho khách" đã có sẵn từ trước (MultiSelect dialog + inline) — không làm lại.
  - **Mỗi field 1 hàng (follow-up cùng ngày):** bỏ `grid-cols-2` ở cả 2 form drawer (`grid grid-cols-2 gap-3` → `grid gap-3`; 3 chỗ customer + 5 chỗ appointment); design.md thêm decision 4. `tsc --noEmit` sạch.
  - **Kiểm chứng:** `tsc --noEmit` sạch; `next build` PASS.
- **File ảnh hưởng:** thêm `openspec/changes/drawer-forms-booking-prefill/*`; sửa `components/appointments/appointment-dialog.tsx`, `components/customers/customers-manager.tsx`, `app/(app)/appointments/page.tsx`.
- **Còn dở / ghi chú:**
  - Chưa test tay runtime (cần migration appointments + đăng nhập) — mới verify build/tsc.
  - Đổi khách sau khi đã sửa tay Nguồn/Dịch vụ trong form → bị ghi đè theo khách mới (chấp nhận, đã ghi design).
  - Chưa archive 8 openspec change (thêm `drawer-forms-booking-prefill`).

### 2026-07-10 — Quản lý lịch hẹn (/appointments) — thay workflow Excel booking
- **Thay đổi:**
  - **OpenSpec:** `openspec/changes/appointment-management/` — design đã có từ trước; session này viết bổ sung proposal + specs + tasks (5/5 done, validate PASS) — **chưa archive**.
  - **DB:** `supabase/migrations/20260710130000_appointments.sql` — bảng `appointments` (FK customer cascade/staff set-null, scheduled_at nullable, status check constraint, tiền numeric(12,2), 4 mốc `*_at`, created_by/updated_by, soft-delete; 4 index partial), `appointment_services` (PK kép, service FK **restrict**), `appointment_status_history` (immutable — trigger `log_appointment_status` **security definer** ghi khi status đổi, changed_by = auth.uid(); chỉ grant select/insert). RLS authenticated toàn quyền (trừ history). Idempotent, chạy tay.
  - **Types/helpers:** `types/appointment.ts` (APPOINTMENT_STATUSES/PAYMENT_METHODS const, Appointment, AppointmentInput); `lib/appointments.ts` (STATUS_ORDER nhóm như sheet; `localDay` — lọc ngày theo giờ LOCAL vì cắt 10 ký tự UTC lệch ngày với giờ sáng UTC+7, nhân bản 3 dòng formatISODate để file còn test được bằng node; `outstanding` — Sisa, fallback expected khi chưa có final; `dayTotal`; `matchesAppointmentFilters`; `sortForDayView`).
  - **Actions (`app/(app)/appointments/actions.ts`):** `createAppointment` (có ngày → booked, không → pending_confirmation), `updateAppointment` (pending + chốt ngày → booked + confirmed_at), `setAppointmentStatus` (whitelist status, stamp mốc, completed nhận final_amount + payment_method), `rescheduleAppointment` (dời lịch = sự kiện, status giữ nguyên; pending → booked), `deleteAppointment` (soft). `advanceCustomerStage` — nâng stage khách **chỉ đi tiến** theo sort_order. `syncServices` copy pattern customer_services (delete-all-insert, ponytail không transaction).
  - **UI:** `components/appointments/appointments-manager.tsx` (2 tab Trong ngày/Chờ xếp lịch, DatePicker + lọc status/staff/service + search tên/phone, bảng 10 cột nhóm theo trạng thái có row header đếm, 4 cột tiền tabular-nums + Còn nợ destructive, action nhanh theo status, tổng doanh thu ngày, xóa AlertDialog); `appointment-dialog.tsx` (rhf+zod 2 cột: khách khóa được qua `customerLock`, ngày+giờ `<input type=time>` native — trống = chờ xếp lịch, thời lượng/staff/nguồn/dịch vụ MultiSelect, 3 ô tiền + phương thức, 2 textarea ghi chú); `status-tag.tsx` (STATUS_META hardcode màu+icon, render EnumTag).
  - **Nối hệ thống:** sidebar "Lịch hẹn" (mọi user, CalendarDays); `/customers` thêm nút Đặt lịch + lịch sử lịch hẹn (badge đếm, dialog kèm status tag + tiền), page query thêm appointments; **tách `components/common/user-avatar.tsx`** (UserAvatar + staffLabel + StaffRef) từ customers-manager để tái dùng; `deleteService` chặn thêm khi còn dòng `appointment_services`; i18n namespace `appointments` (72 key) + `nav.appointments` vi/en/id.
  - **Kiểm chứng:** `node --test lib/appointments.test.ts` 6/6 PASS; `tsc --noEmit` sạch; `next build` PASS (route `/appointments`); eslint chỉ còn warning `watch()` có sẵn.
- **File ảnh hưởng:** thêm `supabase/migrations/20260710130000_appointments.sql`, `types/appointment.ts`, `lib/appointments{,.test}.ts`, `app/(app)/appointments/{page,actions}.tsx`, `components/appointments/{appointments-manager,appointment-dialog,status-tag}.tsx`, `components/common/user-avatar.tsx`, `openspec/changes/appointment-management/{proposal.md,tasks.md,specs/appointments/spec.md}`; sửa `app/(app)/customers/page.tsx`, `components/customers/customers-manager.tsx`, `app/(app)/services/actions.ts`, `components/layout/app-sidebar.tsx`, `messages/{vi,en,id}.json`.
- **Còn dở / ghi chú:**
  - ⚠️ **Phải chạy migration** `20260710130000_appointments.sql` trong Supabase SQL Editor (SAU services + customer_services) thì `/appointments` mới hoạt động.
  - Chưa test tay runtime (cần migration + đăng nhập) — mới verify test/tsc/build.
  - Bỏ qua (YAGNI, đã ghi design): toggle Calendar view; tab "Sắp đến hạn tái hẹn"; action nhanh "Đặt lịch tái hẹn" sau hoàn tất (tạo tay bằng nút Đặt lịch); UI xem status history (DB đã ghi đủ); chặn double-booking; search trong select khách (thêm combobox khi danh sách khách dài).
  - Nạp toàn bộ lịch chưa xóa + lọc client-side (đồng nhất /customers) — giới hạn khoảng ngày server-side khi dữ liệu lớn.
  - Chưa archive 7 openspec change (thêm `appointment-management`).

### 2026-07-10 — Đồng bộ kích thước tag + màu EnumTag đọc được trên dark mode
- **Thay đổi:**
  - **`components/ui/badge.tsx`:** phóng nhẹ base Badge (nguồn size duy nhất của mọi tag): `h-5→h-6`, `px-2→px-2.5`, `text-xs→text-[13px]`, `gap-1→gap-1.5`, icon `size-3→size-3.5` — mọi nơi dùng Badge/EnumTag (customers, enums, services badge, multi-select, users) tự đồng bộ, không sửa từng nơi.
  - **`components/common/enum-tag.tsx`:** bỏ inline style hex+alpha → CSS var `--tag` + Tailwind v4 opacity modifier; dark mode: chữ = `color-mix(in oklab, var(--tag) 65%, white)` (pha sáng để màu tối không chìm), nền 20%/viền 40% (đậm hơn light 10%/25%).
  - **Kiểm chứng:** `tsc --noEmit` sạch.
- **File ảnh hưởng:** `components/ui/badge.tsx`, `components/common/enum-tag.tsx`, `memory-bank/README.md`.
- **Còn dở / ghi chú:** bubble đếm ghi chú (`h-4 text-[10px]`) và badge sidebar là counter, không phải tag — giữ nguyên.

### 2026-07-10 — Multi-select dịch vụ (dialog + inline bảng) thay chip toggle
- **Thay đổi:**
  - **Component mới `components/common/multi-select.tsx`:** `MultiSelect` dùng chung — Radix Select không hỗ trợ multi nên dựng trên **Popover** có sẵn (không dependency mới): trigger style như `SelectTrigger` (badge các mục đã chọn / placeholder, `children` thay được nội dung trigger), popover danh sách button toggle + icon Check (ẩn `invisible` khi chưa chọn), controlled `value: string[]` + `onValueChange` mỗi toggle, `onOpenChange` passthrough. Option type tái dùng `SelectOption` từ clearable-select.
  - **Dialog /customers:** bỏ chip toggle → `MultiSelect` qua RHF Controller `service_ids`, placeholder key mới `customers.pickServices` (vi/en/id).
  - **Inline bảng:** cột Dịch vụ thành `InlineServices` (nội bộ customers-manager): MultiSelect với trigger = chính `serviceBadges` (style ghost như InlineSelect, chevron size-3), **draft nội bộ, lưu 1 LẦN khi đóng popover** nếu danh sách đổi (so như tập hợp — toggle đổi thứ tự không tính) → tránh spam action/toast mỗi toggle.
  - **Action:** `patchCustomer` whitelist thêm `service_ids` → gọi `syncServices`; update bảng customers chỉ chạy khi có field thường.
  - **OpenSpec:** cập nhật vào change `customer-services-link` (spec: requirement dialog sửa lại + requirement inline mới; design decision 4; tasks mục 5 mới, đánh số lại mục 6). Validate PASS.
  - **Kiểm chứng:** `tsc --noEmit` sạch; `next build` PASS.
- **File ảnh hưởng:** thêm `components/common/multi-select.tsx`; sửa `components/customers/customers-manager.tsx`, `app/(app)/customers/actions.ts`, `messages/{vi,en,id}.json`, `openspec/changes/customer-services-link/{design.md,tasks.md,specs/customer-services/spec.md}`, `memory-bank/README.md`.
- **Còn dở / ghi chú:**
  - Chưa test tay runtime (cần migration `20260710120000` + đăng nhập).
  - Popover chưa có ô search — thêm khi danh sách dịch vụ dài (đã ghi trong design).
  - Inline lưu khi đóng popover: đóng bằng Esc/click ngoài đều lưu; không có nút hủy thay đổi (chấp nhận — toggle lại là xong).

### 2026-07-10 — Gắn dịch vụ cho khách hàng (customer ↔ service) + lọc theo dịch vụ
- **Thay đổi:**
  - **OpenSpec:** `openspec/changes/customer-services-link/` (proposal/design/specs/tasks, 12/12 done, validate PASS) — **chưa archive**.
  - **DB:** `supabase/migrations/20260710120000_customer_services.sql` — bảng nối `customer_services` (PK kép `(customer_id, service_id)`; FK `customer_id → customers` **cascade**, `service_id → services` **restrict**; index theo service_id; RLS mọi authenticated toàn quyền như customers). Idempotent, chạy tay.
  - **Types:** `Customer.service_ids: string[]` (map từ bảng nối), `CustomerInput.service_ids?: string[]` (không gửi = giữ nguyên).
  - **Đọc:** page /customers dùng **nested select PostgREST** `customers.select("*, customer_services(service_id)")` → map `service_ids`; query thêm bảng `services` (cả inactive để hiện tên cũ).
  - **Ghi:** helper `syncServices` trong `customers/actions.ts` — delete-all-insert bảng nối trong `createCustomer` (insert → `.select("id").single()`) và `updateCustomer`. 2 lệnh không transaction (ponytail đã ghi, nâng RPC khi cần).
  - **UI /customers:** cột "Dịch vụ" (Badge secondary theo locale, fallback vi; trống "—"; colSpan empty 9→10, sau cột Nguồn); bộ lọc `ClearableSelect` dịch vụ (`CustomerFilters.serviceId`, client-side); dialog tạo/sửa chọn dịch vụ bằng **chip toggle** (button aria-pressed, nối RHF qua Controller `service_ids`; hiện active + dịch vụ đang gắn kể cả inactive; danh sách services rỗng → ẩn khối).
  - **/services:** `deleteService` chặn xóa khi còn dòng nối — đếm **mọi** dòng `customer_services` (kể cả khách soft-delete, khớp hành vi FK restrict), message tiếng Việt gợi ý tắt Kích hoạt (pattern `deleteOption`).
  - **Helper:** `serviceName(s, locale)` trong `lib/customers.ts` (fallback name_vi, cùng quy tắc optionLabel).
  - **i18n:** `customers.{allServices, colServices}` vi/en/id.
  - **Kiểm chứng:** `node --test lib/customers.test.ts` **7/7 PASS** (+2 test mới); `tsc --noEmit` sạch; `next build` PASS.
- **File ảnh hưởng:** thêm `supabase/migrations/20260710120000_customer_services.sql`, `openspec/changes/customer-services-link/*`; sửa `types/customer.ts`, `lib/customers.ts`, `lib/customers.test.ts`, `app/(app)/customers/{page.tsx,actions.ts}`, `app/(app)/services/actions.ts`, `components/customers/customers-manager.tsx`, `messages/{vi,en,id}.json`.
- **Còn dở / ghi chú:**
  - ⚠️ **Phải chạy migration** `20260710120000_customer_services.sql` trong Supabase SQL Editor (SAU `20260710100000_services.sql`) thì gắn/lọc dịch vụ mới hoạt động.
  - Chưa test tay runtime (cần migration + đăng nhập).
  - Dịch vụ chỉ gắn với khách đã soft-delete vẫn không xóa cứng được (FK restrict) — tắt Kích hoạt là đủ (đã ghi trong design).
  - Chưa archive 6 openspec change (thêm `customer-services-link`).

### 2026-07-10 — Đa ngôn ngữ enums & services thành KHÔNG bắt buộc
- **Thay đổi:**
  - **DB:** `supabase/migrations/20260710113000_optional_translations.sql` — drop not null `enum_options.label_en/label_id` + `services.name_en/name_id` (idempotent, chạy tay). Migration services gốc `20260710100000` cũng nới sẵn name_en/name_id nullable (chưa chạy nên sửa được; nếu đã lỡ chạy thì file alter phủ).
  - **Types:** `EnumOption.label_en/label_id` và `Service.name_en/name_id` → `string | null`; input `createOption`/`updateOption` nhận null (ServiceInput tự theo qua Omit).
  - **Form:** enums + services chỉ bắt buộc tiếng Việt; ô En/Id bỏ validate, placeholder "Không bắt buộc" (key i18n `optional` thêm vào 2 namespace × 3 locale); submit `"" → null`. Bảng: ô En/Id trống hiện "—" muted (enums không render tag rỗng).
  - **Fallback hiển thị:** `optionLabel` (lib/customers.ts) → locale en/id thiếu nhãn thì trả `label_vi` (customers dùng chung, khỏi sửa gì thêm). Preview tag trong dialog enums vốn đã fallback vi/value.
  - **OpenSpec:** cập nhật vào change `enums-submenu-and-services` (chưa archive) — sửa 2 delta spec + tasks mục 4.
  - **Kiểm chứng:** `node --test lib/customers.test.ts` 5/5 PASS (+2 assert fallback); `tsc --noEmit` sạch; `next build` PASS.
- **File ảnh hưởng:** thêm `supabase/migrations/20260710113000_optional_translations.sql`; sửa `supabase/migrations/20260710100000_services.sql`, `types/{customer,service}.ts`, `lib/customers.ts`, `lib/customers.test.ts`, `app/(app)/enums/actions.ts`, `components/enums/enums-manager.tsx`, `components/services/services-manager.tsx`, `messages/{vi,en,id}.json`, `openspec/changes/enums-submenu-and-services/{tasks.md,specs/*}`.
- **Còn dở / ghi chú:**
  - ⚠️ **Chạy migration theo thứ tự:** `20260710100000_services.sql` rồi `20260710113000_optional_translations.sql` trong Supabase SQL Editor.
  - Dữ liệu seed enum cũ vẫn có đủ 3 ngữ — không cần backfill; chỉ giá trị tạo mới mới có thể null.
  - Chưa test tay runtime (cần migration + đăng nhập admin).

### 2026-07-10 — Tách /enums thành menu con theo kind + CRUD Dịch vụ (/services)
- **Thay đổi:**
  - **OpenSpec:** `openspec/changes/enums-submenu-and-services/` (proposal/design/specs/tasks, 11/11 done, validate PASS) — **chưa archive**.
  - **Enums tách trang con:** `types/customer.ts` thêm `ENUM_KINDS` const (EnumKind derive từ đó); `EnumsManager` nhận prop `kind` (bỏ vòng lặp KINDS, title = tên kind); mới `app/(app)/enums/[kind]/page.tsx` (Next 16: `params` là **Promise**, phải `await`; kind lạ → `notFound()`; query 1 kind); `/enums` → `redirect("/enums/stage")`. Proxy gác `startsWith("/enums")` phủ luôn route con — không sửa.
  - **Sidebar submenu:** mục "Danh mục" = `SidebarMenuButton` Link `/enums/stage` (active `startsWith("/enums")`) + `SidebarMenuSub` 3 mục con label từ `enums.kind_*` (active theo path đầy đủ). Không cài `collapsible` — sub luôn mở, tự ẩn khi sidebar thu gọn icon.
  - **DB:** `supabase/migrations/20260710100000_services.sql` — bảng `public.services` (name 3 ngữ, sort_order, is_active, timestamps; KHÔNG giá/mô tả — YAGNI), index sort, trigger `set_updated_at()` tái dùng, RLS đọc-authenticated/ghi-admin + grant giống enum_options. Idempotent, chạy tay.
  - **CRUD /services (admin):** `app/(app)/services/{page,actions}.tsx` (`createService`/`updateService`/`deleteService` đều `requireAdmin()`, xóa cứng chưa check usage vì chưa gì tham chiếu) + `components/services/services-manager.tsx` (bảng Vi/En/Id + toggle kích hoạt trực tiếp + dialog rhf+zod 2 cột + xóa `window.confirm` — đồng nhất enums-manager). `proxy.ts` thêm `/services` vào isAdminRoute; sidebar mục "Dịch vụ" (icon Briefcase, admin).
  - **i18n:** vi/en/id — `nav.services` + namespace `services` (đủ bộ key như enums trừ icon/màu). Key `enums.title` không còn dùng (title giờ theo kind) — để lại, vô hại.
  - **Kiểm chứng:** `tsc --noEmit` sạch; `next build` PASS (route `/enums/[kind]`, `/services` dynamic).
- **File ảnh hưởng:** thêm `openspec/changes/enums-submenu-and-services/*`, `app/(app)/enums/[kind]/page.tsx`, `app/(app)/services/{page,actions}.tsx`, `components/services/services-manager.tsx`, `supabase/migrations/20260710100000_services.sql`, `types/service.ts`; sửa `app/(app)/enums/page.tsx`, `components/enums/enums-manager.tsx`, `components/layout/app-sidebar.tsx`, `types/customer.ts`, `proxy.ts`, `messages/{vi,en,id}.json`.
- **Còn dở / ghi chú:**
  - ⚠️ **Phải chạy migration** `20260710100000_services.sql` trong Supabase SQL Editor thì bảng services mới có (trước đó /services sẽ hiện danh sách rỗng).
  - Chưa test tay runtime (cần migration + đăng nhập admin) — mới verify build/tsc.
  - Service chưa gắn vào customers; khi gắn nhớ thêm check usage vào `deleteService` (pattern `deleteOption` có sẵn).
  - Chưa archive 5 openspec change: `enums-submenu-and-services`, `customers-user-avatars`, `customers-table-inline-edit`, `add-customer-notes-column`, `add-enum-tag-icons`.

### 2026-07-10 — Avatar user ở cột Nhân viên + Lịch sử ghi chú (/customers)
- **Thay đổi:**
  - **OpenSpec:** `openspec/changes/customers-user-avatars/` (proposal/design/specs/tasks, 5/5 done, validate PASS) — **chưa archive**. Không migration DB (`profiles.avatar_url` + RLS đọc profiles đã có).
  - Page query staff mở rộng `select id, user_name, avatar_url`; type `Staff` thêm `avatar_url`.
  - Helper `UserAvatar` (nội bộ `customers-manager.tsx`): `<img>` tròn size-5, fallback `app/assets/avt.webp` — đúng pattern header, KHÔNG thêm shadcn Avatar.
  - Cell Nhân viên: `display` của InlineSelect = avatar + tên (chưa gán vẫn "—", không avatar).
  - **Option Select nhân viên cũng có avatar** (feedback): nới `SelectOption.label` (clearable-select) + `options.label` (InlineSelect) `string` → `React.ReactNode`; helper module-level `staffLabel(s)` = avatar + tên dùng chung 4 chỗ (cell bảng, option inline select, option thanh lọc, option dialog). ItemText Radix nhận node → trigger thanh lọc tự hiện avatar khi chọn.
  - Dialog Lịch sử ghi chú: avatar người ghi cạnh tên — tra `staff.find(user_name === note.by)` (note chỉ lưu tên snapshot); không match → avatar fallback; `by` rỗng → "—" không avatar.
  - **Kiểm chứng:** `tsc --noEmit` sạch; `next build` PASS.
- **File ảnh hưởng:** thêm `openspec/changes/customers-user-avatars/*`; sửa `app/(app)/customers/page.tsx`, `components/customers/customers-manager.tsx`.
- **Còn dở / ghi chú:**
  - Chưa test tay runtime (cần đăng nhập) — mới verify build/tsc.
  - Tra avatar note theo tên → trùng tên có thể nhầm avatar; nâng cấp: stamp `by_id` vào note mới.
  - Chưa archive 4 openspec change: `customers-user-avatars`, `customers-table-inline-edit`, `add-customer-notes-column`, `add-enum-tag-icons`.

### 2026-07-10 — Fix vị trí popup của InlineSelect (/customers)
- **Thay đổi:** Popup select inline (Giai đoạn/Nguồn/Nhân viên) bung lên góc trên-trái màn hình thay vì bám vào ô. Root cause: `SelectContent` mặc định `position="item-aligned"` — chế độ này của Radix cần node `<SelectValue>` trong trigger để đo toạ độ; `InlineSelect` render `{display}` trần nên Radix bỏ qua bước định vị, wrapper `position:fixed` nằm ở (0,0). Fix: bọc `display` trong `<SelectValue>` (giống `ClearableSelect` vốn hoạt động đúng). `tsc --noEmit` sạch.
- **Thay đổi (tiếp):** `InlineSelect` chuyển `SelectContent position="popper"` → popup luôn thả xuống DƯỚI trigger (thay vì item-aligned đè lên tag). `SelectItem` trong `select.tsx` đổi `cursor-default` → `cursor-pointer` (root fix cho mọi select; class `cursor-pointer` per-item ở language-switcher giờ thừa, chưa gỡ).
- **File ảnh hưởng:** `components/customers/customers-manager.tsx`, `components/ui/select.tsx`.
- **Còn dở / ghi chú:** Chưa test tay runtime (cần đăng nhập). Bài học: mọi `SelectTrigger` của repo này PHẢI chứa `<SelectValue>` vì select.tsx mặc định item-aligned.
- **Thay đổi:**
  - **OpenSpec:** `openspec/changes/customers-table-inline-edit/` (proposal/design/specs/tasks, 7/7 done) — **chưa archive**. Không migration DB.
  - **Dialog tạo/sửa gọn:** bỏ khối "Lịch sử ghi chú" + ô "Thêm ghi chú" (ghi chú chỉ còn qua cột Ghi chú ở bảng). `CustomerInput` **bỏ hẳn `notes`/`note`**; `clean()` thành sync, không đụng cột `notes` (create dựa default `[]` DB) → **fix luôn race** "dialog gửi snapshot notes đè note thêm từ popover" ghi nhận session trước.
  - **Xóa khách = AlertDialog shadcn** (popconfirm): state `deleting`, 1 dialog dùng chung ngoài vòng map, title `deleteConfirm` + body `deleteConfirmBody {name}`, nút Xóa destructive. Bỏ `window.confirm`.
  - **Inline edit trên bảng:** component `InlineSelect` (trong `customers-manager.tsx`) — Radix Select với trigger là chính giá trị hiển thị (EnumTag/tên, hover bg-accent, chevron nhỏ, override `data-[size=default]:h-auto`); sentinel `__none` bỏ chọn cho Nguồn/Nhân viên; Giai đoạn luôn có giá trị. Action mới **`patchCustomer(id, {stage?, source?, staff_id?})`** whitelist từng trường, stage ≠ lost → `lost_reason=null` (đồng nhất `clean()`); toast `updateOk` + refresh; select disable khi pending. Helper `kindOptions`/`staffOptions` dùng chung cho cả thanh lọc (bỏ `activeByKind`).
  - **i18n:** vi/en/id — sửa `deleteConfirm` ngắn lại, thêm `deleteConfirmBody {name}`, xóa key `noteHistory` (không còn dùng).
  - **Kiểm chứng:** `tsc --noEmit` sạch; `next build` PASS.
- **File ảnh hưởng:** thêm `openspec/changes/customers-table-inline-edit/*`; sửa `types/customer.ts`, `app/(app)/customers/actions.ts`, `components/customers/customers-manager.tsx`, `messages/{vi,en,id}.json`.
- **Còn dở / ghi chú:**
  - Chưa test tay runtime (cần đăng nhập) — mới verify build/tsc.
  - Đổi Giai đoạn sang `lost` inline **không hỏi lý do** — lost_reason để trống, bổ sung qua dialog sửa (chấp nhận, đã ghi trong design).
  - Chưa archive 3 openspec change: `customers-table-inline-edit`, `add-customer-notes-column`, `add-enum-tag-icons`.

### 2026-07-08 — Cột Ghi chú ở bảng /customers (thêm nhanh + lịch sử, lưu người ghi)
- **Thay đổi:**
  - **OpenSpec:** `openspec/changes/add-customer-notes-column/` (proposal/design/specs/tasks, 7/7 done) — **chưa archive**.
  - **Không migration DB** — `customers.notes` là jsonb, chỉ thêm trường `by` trong JSON.
  - **Types:** `CustomerNote.by?: string|null` (tên người ghi — snapshot, không phải id); `CustomerInput.note?: string` (text note mới) — client KHÔNG tự đặt `at`/`by` nữa.
  - **Actions (`app/(app)/customers/actions.ts`):** `stampNote(text)` = `{text, at: now, by: profile.user_name}` server-side; `clean()` thành async, append note stamped từ `input.note`; action mới **`addCustomerNote(id, text)`** — đọc `notes` từ DB → append → update (không nhận mảng từ client).
  - **UI (`customers-manager.tsx`):** cột **Ghi chú** (trước Thao tác, colSpan empty 8→9) với 2 nút ghost: **Plus** = `QuickNote` (Popover: textarea + nút Lưu, disable khi rỗng/pending, toast + refresh) và **Info** (badge đếm số note ở góc nút, >9 hiện "9+") = mở Dialog "Lịch sử ghi chú - {tên}" (state `historyFor`; danh sách **mới nhất trước** — reverse; mỗi mục: badge thời gian `bg-primary/15 text-primary` + tên người ghi ("—" nếu note cũ thiếu `by`) + text box `whitespace-pre-wrap`); Info **disabled khi chưa có note**. Dialog tạo/sửa: gửi `note` text rời (server stamp), lịch sử trong dialog hiện `— {by}`.
  - **i18n:** thêm `customers.{colNotes, viewNotes, noteHistoryTitle {name}, noteOk}` cho vi/en/id.
  - **Kiểm chứng:** `tsc --noEmit` sạch; `next build` PASS.
- **File ảnh hưởng:** thêm `openspec/changes/add-customer-notes-column/*`; sửa `types/customer.ts`, `app/(app)/customers/actions.ts`, `components/customers/customers-manager.tsx`, `messages/{vi,en,id}.json`.
- **Còn dở / ghi chú:**
  - Chưa test tay runtime (cần đăng nhập) — mới verify build/tsc.
  - Race cũ vẫn còn: dialog sửa gửi snapshot `notes` từ lúc mở → note thêm bằng popover trong lúc dialog đang mở có thể bị đè khi bấm Lưu dialog (hiếm; nâng cấp RPC jsonb append nếu thành vấn đề).
  - Note cũ không có `by` → hiện "—" (không backfill).
  - Chưa archive openspec change `add-customer-notes-column` (và `add-enum-tag-icons` từ session trước).

### 2026-07-08 — IconPicker Lucide + tag (icon + màu) cho Giai đoạn/Nguồn
- **Thay đổi:**
  - **OpenSpec:** `openspec/changes/add-enum-tag-icons/` (proposal/design/specs/tasks, 4/4 done) — **chưa archive**.
  - **DB:** `supabase/migrations/20260708090000_enum_options_icon_color.sql` — thêm cột `icon` (tên icon Lucide kebab-case) + `color` (hex `#rrggbb`) vào `enum_options`, check constraint định dạng (drop/add idempotent), seed **màu + icon mặc định cho cả 3 kind** (stage/source/lost_reason; `where color/icon is null`, không đè lựa chọn admin). Lucide đã bỏ icon thương hiệu → instagrams dùng `camera`, whatsapp dùng `message-circle`. Chạy tay SQL Editor, SAU migration customers_and_enums.
  - **IconPicker** (`components/common/icon-picker.tsx`, dùng chung): Popover + Input search trên `iconNames` từ **`lucide-react/dynamic`** (~1600 icon, `DynamicIcon` lazy-load từng icon = `import()` riêng, không phình bundle). Grid tối đa **96** kết quả + bộ đếm "x/y" (`useDeferredValue` giữ ô gõ mượt); chọn/bỏ chọn; value = string kebab-case; text qua props (nơi dùng tự i18n).
  - **EnumTag** (`components/common/enum-tag.tsx`, dùng chung): Badge outline, chữ/icon = màu gốc, nền `hex+"1a"`, viền `hex+"40"` (đọc được cả sáng/tối); không màu → fallback Badge secondary.
  - **/enums:** dialog thêm chọn Icon (IconPicker) + Màu tag (12 swatch preset + `<input type="color">` + nút bỏ màu) + ô **xem trước tag** live; bảng thêm cột "Tag" (colSpan empty 7→8); actions `createOption`/`updateOption` nhận `icon`/`color`. Dialog thêm `max-h-[90vh] overflow-y-auto`.
  - **/customers:** cột Giai đoạn + Nguồn render `EnumTag` (helper `tagFor` thay `labelFor`; option mất → value thô trong badge trung tính; bỏ style destructive riêng cho lost — màu đỏ đã seed).
  - **i18n:** thêm 12 key vào namespace `enums` (colLabel, iconLabel, pickIcon, searchIcon, clearIcon, noIconResults, iconShown `{shown}/{total}`, colorLabel, customColor, clearColor, preview) cho vi/en/id.
  - **UI polish /enums (theo feedback):** bảng **6 cột** (Mã | Tiếng Việt | English | Bahasa | Kích hoạt | Thao tác) — mỗi cột ngôn ngữ render **EnumTag** với nhãn ngôn ngữ đó (bỏ cột Tag riêng); ẩn cột Thứ tự (vẫn sửa trong dialog). **Kích hoạt = checkbox toggle trực tiếp** trong bảng (gọi `updateOption` giữ nguyên các trường còn lại, disabled khi pending). Bảng dùng `table-fixed` + width cố định (value 220px, active/actions w-28) để 3 bảng kind xếp dọc thẳng cột nhau. **Dialog layout 2 cột** (`sm:max-w-xl`): Mã|Thứ tự, Vi|En, Id|Icon; chọn màu làm lại thành `ColorSwatches` — ô tròn size-7: ô "không màu" (X), 12 preset (check trắng khi chọn), ô **màu tùy chỉnh** (conic-gradient + Pipette, `input type=color` opacity-0 phủ trong label; hiện màu custom + check khi đang chọn màu ngoài preset); hàng xem trước + checkbox kích hoạt gộp trong khung dashed.
  - **Kiểm chứng:** `tsc --noEmit` sạch; `next build` PASS (2 lần); eslint chỉ warning React Compiler về `watch()` react-hook-form (pattern có sẵn).
- **File ảnh hưởng:** thêm `supabase/migrations/20260708090000_enum_options_icon_color.sql`, `components/common/{icon-picker,enum-tag}.tsx`, `openspec/changes/add-enum-tag-icons/*`; sửa `types/customer.ts`, `app/(app)/enums/actions.ts`, `components/enums/enums-manager.tsx`, `components/customers/customers-manager.tsx`, `messages/{vi,en,id}.json`.
- **Còn dở / ghi chú:**
  - ⚠️ **Phải chạy migration** `20260708090000` trong Supabase SQL Editor thì cột/constraint/seed màu mới có.
  - Chưa test tay runtime (cần migration + đăng nhập admin) — mới verify build/tsc.
  - Màu + icon đã seed mặc định cho cả stage/source/lost_reason (admin đổi được ở /enums).
  - Select lọc/form ở /customers chưa hiện icon+màu trong option — thêm sau nếu cần.
  - Chưa archive openspec change `add-enum-tag-icons`.

### 2026-07-07 — Loading điều hướng (nextjs-toploader) + phản hồi khi đổi ngôn ngữ
- **Thay đổi:**
  - Cài **`nextjs-toploader@3`**; mount `<NextTopLoader color="var(--primary)" height={2} showSpinner={false} />` ở `app/layout.tsx` (trong `<body>`) → thanh tiến trình top khi click `<Link>`/đổi trang. Màu dùng `var(--primary)` nên tự đổi theo sáng/tối; tắt spinner cho gọn.
  - **Đổi ngôn ngữ chậm** (do `revalidatePath("/","layout")` re-render toàn bộ server components): `language-switcher.tsx` gọi `useTopLoader()` — `loader.start()` trước, `loader.done()` trong `finally` sau khi `await setLocale()` — chạy đúng thanh loader đó để có phản hồi trực quan thay vì đơ. Không thêm overlay/loading.tsx riêng.
  - **Kiểm chứng:** `tsc --noEmit` sạch; `eslint` 2 file sửa sạch.
- **File ảnh hưởng:** sửa `app/layout.tsx`, `components/common/language-switcher.tsx`, `package.json` (+`nextjs-toploader`).
- **Còn dở / ghi chú:**
  - Không đụng gốc chậm: đổi locale vẫn round-trip server (bản chất next-intl chế độ cookie). Muốn tức thời phải nạp messages sang client — re-architecture, chưa cần (YAGNI).
  - `loading.tsx` KHÔNG kích hoạt cho revalidatePath/server action, nên chọn top-loader thay vì thêm `loading.tsx` — đúng nhu cầu "loading page global" mà nhẹ hơn.

### 2026-07-07 — UI polish trang Khách hàng: shadcn Select + date picker, reload, xác nhận đăng xuất
- **Thay đổi:**
  - **shadcn components mới** (qua CLI, style `radix-nova`): `components/ui/{popover,calendar,alert-dialog}.tsx`. Kéo theo dep `react-day-picker@10` + `date-fns@4`.
  - **Date picker dùng chung:** `components/common/date-picker.tsx` — `DatePicker` (đơn) + `DateRangePicker` (range), value/onChange dạng chuỗi `YYYY-MM-DD`, popover + `Calendar`, localize lịch theo locale (date-fns vi/en/id). Helper thuần `lib/date.ts` (`parseISODate`/`formatISODate`, so theo **giờ local** tránh lệch ngày) + test `lib/date.test.ts` (3/3 PASS).
  - **Trang `/customers`:** thay toàn bộ `<select>` native → **shadcn Select** (lọc stage/source/staff + form stage/source/lost_reason/staff); Radix Select không nhận value rỗng nên dùng sentinel `__all`/`__none` map về "". Bỏ 2 date input → **1 `DateRangePicker`** (lọc theo created_at). `first_contact` trong form → `DatePicker`. Thêm nút **Tải lại** (`router.refresh()` trong transition, icon quay khi pending). Ô tìm kiếm thu ngắn (`sm:max-w-[220px]`, h-8).
  - **Xác nhận đăng xuất:** `components/layout/sign-out-button.tsx` (client) bọc `AlertDialog` quanh nút đăng xuất; `app-header.tsx` dùng component này thay `<form action={signOut}>`. Gọi server action `signOut` trong `useTransition`.
  - **i18n:** thêm `auth.{cancel,signOutConfirmTitle,signOutConfirmBody}` + `customers.{reload,dateRange,pickDate,clearDate}` (bỏ `fromDate`/`toDate` không dùng nữa) cho vi/en/id.
  - **Kiểm chứng:** `node --test lib/date.test.ts` 3/3 PASS; `tsc --noEmit` sạch; `next build` PASS.
- **File ảnh hưởng:** thêm `components/ui/{popover,calendar,alert-dialog}.tsx`, `components/common/date-picker.tsx`, `components/layout/sign-out-button.tsx`, `lib/date.ts`, `lib/date.test.ts`; sửa `components/customers/customers-manager.tsx`, `components/layout/app-header.tsx`, `messages/{vi,en,id}.json`, `package.json` (+react-day-picker, date-fns).
- **Còn dở / ghi chú:**
  - Trang `/banned` vẫn dùng `<form action={signOut}>` (nút thoát của trang khoá — cố ý không thêm xác nhận).
  - Lịch trong popover hiển thị 2 tháng cho range; đã localize theo date-fns. Popover/Select lồng trong Dialog theo pattern chuẩn shadcn — chưa test tay runtime (mới build/tsc).

### 2026-07-07 — CRUD Khách hàng + Quản lý danh mục Enum
- **Thay đổi:**
  - **DB:** `supabase/migrations/20260707140000_customers_and_enums.sql` (idempotent, chạy tay). Bảng `enum_options` (lookup 3 ngữ, `unique(kind,value)`, seed đủ stage/source/lost_reason) + `customers` (identity/phân loại/first_contact/notes jsonb/soft-delete). **Bỏ unique** theo yêu cầu — chỉ index thường (stage/source/staff_id/created_at, đa số partial `where deleted_at is null`; phone). Trigger `set_updated_at()` dùng chung. RLS: `enum_options` đọc-authenticated/ghi-admin; `customers` toàn quyền authenticated; **thêm** `profiles_select_authenticated` (mọi user đọc profiles cho staff dropdown). Phụ thuộc `is_admin()`/`profiles` từ migration user-management.
  - **Enum (admin `/enums`):** `app/(app)/enums/{page,actions}.tsx` + `components/enums/enums-manager.tsx` (3 khối kind, bảng + dialog thêm/sửa, value cố định sau tạo, `deleteOption` chặn nếu đang được customers dùng → gợi ý tắt is_active).
  - **Khách hàng (`/customers`):** `app/(app)/customers/{page,actions}.tsx` + `components/customers/customers-manager.tsx` (bảng + thanh lọc + dialog form; `<select>` native cho stage/source/staff/lost_reason; lost_reason chỉ hiện khi stage=lost; first_contact `<input type=date>`; notes = lịch sử + ô thêm note, append client-side gửi cả mảng; xóa mềm `deleted_at`). Helper thuần `lib/customers.ts` (`matchesCustomerFilters`, `optionLabel`) + `types/customer.ts`.
  - **Nối hệ thống:** `proxy.ts` gác `/enums` admin-only (cạnh `/users`); `app-sidebar.tsx` thêm "Khách hàng" (mọi user) + "Danh mục" (admin); i18n `nav.customers/enums` + namespace `customers`/`enums` cho vi/en/id.
  - **Kiểm chứng:** `tsc --noEmit` sạch; `next build` PASS (route `/customers`, `/enums` = dynamic); `node --test lib/customers.test.ts` 5/5 PASS.
- **File ảnh hưởng:** thêm `supabase/migrations/20260707140000_customers_and_enums.sql`, `types/customer.ts`, `lib/customers.ts`, `lib/customers.test.ts`, `app/(app)/enums/{page,actions}.tsx`, `components/enums/enums-manager.tsx`, `app/(app)/customers/{page,actions}.tsx`, `components/customers/customers-manager.tsx`; sửa `proxy.ts`, `components/layout/app-sidebar.tsx`, `messages/{vi,en,id}.json`.
- **Còn dở / ghi chú:**
  - ⚠️ **Phải chạy migration** trong Supabase SQL Editor thì bảng/RLS mới có (phụ thuộc migration user-management đã chạy trước).
  - Chưa test tay end-to-end (cần chạy migration + đăng nhập admin). Mới verify build/tsc/unit.
  - Lọc **client-side** — chuyển sang query server nếu dữ liệu khách lớn (`-- ponytail` đã ghi). Search ilike sẽ seq-scan; thêm pg_trgm khi cần.
  - Notes gửi cả mảng, **không khoá đồng thời** — 2 người sửa cùng 1 khách có thể ghi đè note của nhau (hiếm).
  - `profiles` giờ cho **mọi user đăng nhập đọc** (lộ email/role) — siết bằng view chỉ-tên nếu cần riêng tư.
  - Không tạo openspec docs cho change này (dùng plan file trực tiếp làm đề xuất).

### 2026-07-07 — Storage: bucket `images` + component upload ảnh
- **Thay đổi:**
  - **DB/Storage:** `supabase/migrations/20260707130000_storage_images_bucket.sql` — tạo/cập nhật bucket public `images` (limit 5MB, `allowed_mime_types` ảnh) + 4 policy trên `storage.objects`: `images_read` (đọc công khai), `images_insert_own`/`images_update_own`/`images_delete_own` (chỉ `authenticated`, ràng `(storage.foldername(name))[1] = auth.uid()`). Idempotent, chạy tay trong SQL Editor.
  - **Helper:** `lib/supabase/storage-path.ts` (thuần: `objectPathFromPublicUrl`, `fileExt`, hằng `IMAGES_BUCKET`) + `lib/supabase/storage.ts` (`uploadImage` → upload vào `{user_id}/{folder?}/{uuid}.{ext}` trả public URL; `removeImage` best-effort). Import `./client` **động** để helper thuần test được bằng node.
  - **Component:** `components/common/image-upload.tsx` — `<ImageUpload value onChange bucket? folder? maxSizeMb? label? disabled? className?>`. Dropzone `<label>` + `<input type=file class=sr-only>` (a11y: keyboard + focus-within ring), preview `<img>` + nút X xóa, overlay spinner khi upload, validate type/size phía client + toast lỗi qua `normalizeError`.
  - **Nối vào form tạo user:** `components/users/users-manager.tsx` — thay ô `<Input type=url avatar_url>` bằng `<ImageUpload folder="avatars" className="rounded-full">`, nối RHF qua `watch`/`setValue`. i18n `users.avatarUrl` bỏ "(URL)" → "Ảnh đại diện" / "Avatar" (vi/en/id).
  - **Kiểm chứng:** `node --test lib/supabase/storage-path.test.ts` 6/6 PASS; `tsc --noEmit` sạch (2 lần).
- **File ảnh hưởng:** thêm `supabase/migrations/20260707130000_storage_images_bucket.sql`, `lib/supabase/{storage,storage-path,storage-path.test}.ts`, `components/common/image-upload.tsx`; sửa `components/users/users-manager.tsx`, `messages/{vi,en,id}.json`, `memory-bank/README.md`.
- **Còn dở / ghi chú:**
  - ⚠️ **Cần chạy migration** trong Supabase SQL Editor thì bucket + policy mới có.
  - Chỉ form **tạo user** có upload; chưa có sửa avatar cho user đã tồn tại (chưa có dialog Sửa) — thêm khi dựng.
  - i18n key `users.urlInvalid` giờ không dùng (ImageUpload tự validate) — để lại, vô hại.
  - **Orphan:** đổi ảnh (upload ảnh mới) không xóa ảnh cũ; nút X mới xóa. Dọn định kỳ nếu tích nhiều — chưa làm (YAGNI).
  - i18n: text trong component để mặc định tiếng Việt (prop `label` + toast) thay vì `useTranslations`, để component tự chứa; thêm i18n khi cần đa ngữ ở nơi đặt.
  - Admin upload avatar cho user khác: file rơi vào thư mục của admin (đúng RLS "own folder"); vẫn dùng được vì `avatar_url` chỉ là public URL. Muốn admin ghi mọi thư mục thì thêm policy `is_admin()`.

### 2026-07-07 — UI: dọn sidebar, avatar fallback, xem mật khẩu
- **Thay đổi:**
  - **Sidebar bỏ menu fake:** `app-sidebar.tsx` chỉ còn mục có trang thật — "Tổng quan" (`/`) + "Người dùng" (admin). Bỏ 5 mục trỏ route chưa dựng (contacts/deals/tasks/reports/settings). Key dịch trong `messages/*.json` giữ nguyên để thêm lại khi dựng trang.
  - **Sidebar thu gọn rộng hơn:** `SIDEBAR_WIDTH_ICON` 3rem→3.75rem; icon + logo căn giữa khi thu gọn (`group-data-[collapsible=icon]:items-center`/`justify-center` trong `app-sidebar.tsx`).
  - **Avatar fallback:** header hiện avatar người đăng nhập; không có `avatar_url` → dùng `app/assets/atv.avif` (import tĩnh, render bằng `<img>` vì avatar_url là host tuỳ ý — tránh cấu hình `images.remotePatterns`). `layout.tsx` truyền thêm `avatarUrl`.
  - **Xem mật khẩu:** `login-form.tsx` thêm nút Eye/EyeOff toggle `type` password↔text. i18n key `auth.showPassword`/`hidePassword` (vi/en/id).
  - **Kiểm chứng:** `next build` PASS, TS sạch. (Turbopack cảnh báo không tối ưu avif — vô hại, ảnh vẫn phục vụ.)
- **File ảnh hưởng:** sửa `components/layout/app-sidebar.tsx`, `components/layout/app-header.tsx`, `components/ui/sidebar.tsx`, `components/auth/login-form.tsx`, `app/(app)/layout.tsx`, `messages/{vi,en,id}.json`.
- **Còn dở / ghi chú:**
  - Avatar chỉ hiện ở header (bảng `/users` chưa có cột avatar — thêm khi cần).
  - avatar_url là URL ngoài; nếu sau này muốn dùng `next/image` phải khai báo `images.remotePatterns`.

### 2026-07-07 — Auth + Quản lý người dùng (tính năng nghiệp vụ đầu tiên)
- **Thay đổi:**
  - **OpenSpec:** `openspec/changes/add-user-management/` (proposal/design/specs/tasks, validate PASS) — **chưa archive**.
  - **DB:** `supabase/migrations/20260707120000_user_management.sql` — enum `user_role`/`user_status`, bảng `public.profiles` (1-1 `auth.users`, KHÔNG cột mật khẩu), index lower(user_name)/lower(email), `is_admin()` SECURITY DEFINER + RLS (user đọc mình / admin đọc-sửa hết), trigger `handle_new_user()` tự tạo profile + backfill, grant select cho `authenticated`, seed nâng 1 email thành admin. **Idempotent, chạy tay trong SQL Editor.**
  - **Client Supabase admin:** `lib/supabase/admin.ts` (service_role, `import "server-only"`). Helper `lib/auth.ts`: `getCurrentProfile()`, `requireAdmin()`.
  - **Proxy** (`proxy.ts`) viết lại thành cổng: `getClaims()` → chưa-login+route bảo vệ → `/login`; đã-login vào `/login`|`/banned` → `/`; `status=banned` → `/banned`; `/users` mà `role≠admin` → `/`. Redirect có copy cookie session đã refresh. `PUBLIC_PATHS=['/login','/banned']`.
  - **Auth UI:** `lib/actions/auth.ts` (`signIn` lỗi chung + `signOut`); `app/login/page.tsx` + `components/auth/login-form.tsx` (rhf+zod); `app/banned/page.tsx` (nút đăng xuất). Header hiện tên + nút đăng xuất (form action `signOut`). Sidebar thêm mục "Người dùng" **chỉ khi admin** (`AppSidebar isAdmin`).
  - **Quản lý user:** `app/(app)/users/{page,actions}.tsx` + `components/users/users-manager.tsx` (bảng shadcn, tìm kiếm lọc client theo tên/email, dialog Tạo user [email/mật khẩu/tên/avatar_url/checkbox admin], dialog Đặt lại mật khẩu, nút Cấm/Bỏ cấm). Actions `createUser`/`setUserStatus`/`resetPassword` đều `requireAdmin()` trước; không cho tự cấm mình.
  - shadcn thêm: `dialog`, `label`, `table`, `badge`. Dependency thêm: `server-only`. i18n thêm namespace `auth`+`users`+`nav.users` (vi/en/id). `.env.example`/`.env.local` thêm `SUPABASE_SECRET_KEY`.
  - **Kiểm chứng:** `next build` PASS (TS sạch). Smoke test `next start -p 3100`: chưa-login `/` & `/users` → 307 `/login`; `/login` render form; `/banned` render "Bị khoá" + "Đăng xuất".
- **File ảnh hưởng:** thêm `supabase/migrations/20260707120000_user_management.sql`, `lib/supabase/admin.ts`, `lib/auth.ts`, `lib/actions/auth.ts`, `types/user.ts`, `app/login/page.tsx`, `app/banned/page.tsx`, `app/(app)/users/{page,actions}.tsx`, `components/auth/login-form.tsx`, `components/users/users-manager.tsx`, `components/ui/{dialog,label,table,badge}.tsx`; sửa `proxy.ts`, `app/(app)/layout.tsx`, `components/layout/{app-header,app-sidebar}.tsx`, `messages/{vi,en,id}.json`, `.env.example`, `.env.local`, `CLAUDE.md` (+§4 migrations), `package.json` (+`server-only`).
- **Còn dở / ghi chú:**
  - ⚠️ **Người dùng cần làm để chạy thật:** (1) copy migration vào Supabase SQL Editor chạy; (2) tạo admin đầu tiên (Dashboard > Auth > Users hoặc tạo qua app) rồi sửa email trong dòng seed `update ... set role='admin'`; (3) điền `SUPABASE_SECRET_KEY` (secret/service_role) vào `.env.local`.
  - Luồng đăng nhập/tạo/cấm/reset **chưa test tay end-to-end** (cần bước trên). Mới verify build + proxy chưa-login.
  - `proxy.ts` truy vấn `profiles` mỗi request — ceiling đã ghi chú (nâng lên JWT claim nếu độ trễ thành vấn đề).
  - Ngoài phạm vi (chưa làm): self-service đổi/quên mật khẩu (cần SMTP), upload avatar (chỉ lưu URL).
  - Chưa `openspec archive add-user-management`.

### 2026-07-07 — UI polish: Select ngôn ngữ (shadcn + cờ), dark mode, cursor-pointer, logo
- **Thay đổi:**
  - **Cursor pointer** (root-cause: Tailwind v4 preflight bỏ pointer của `<button>`): rule base ở `app/globals.css` cho `button:not(:disabled)` + `[role="button"]:not([aria-disabled])` → mọi nút/trigger/sidebar có pointer; options Select thêm `cursor-pointer`.
  - **Đổi ngôn ngữ**: thay `<select>` native bằng **shadcn Select**. Mỗi mục có **cờ SVG nội tuyến** (vi/en/id — không thêm dependency) + tên ngôn ngữ. Trigger render trực tiếp cờ+tên theo locale hiện tại (đúng từ SSR, không dựa vào Radix phản chiếu `ItemText` vì options nằm trong portal đóng).
  - **Dark mode**: cài `next-themes`; `ThemeProvider` (class, `defaultTheme="system"`, `enableSystem`) ở `app/providers.tsx`; `<html suppressHydrationWarning>`; nút `ThemeToggle` (sun/moon) ở header; `sonner.tsx` gắn `theme` từ next-themes.
  - **Logo**: `components/layout/logo.tsx` (badge gradient tím + "L" + chấm nhấn, SVG) thay ô chữ "L" phẳng; wordmark "LAVIAN **CRM**" ("CRM" màu primary).
  - i18n: thêm `theme.toggle` vào `messages/{en,vi,id}.json`.
  - **Kiểm chứng:** `next build` PASS; `next start -p 3100` + curl → SSR có cờ VN (`#da251d`) + "Tiếng Việt" trong trigger, CSS có `cursor:pointer`, ThemeToggle render (`lucide-moon`), Select là `data-slot="select-trigger"`, không lỗi i18n.
- **File ảnh hưởng:** thêm `components/layout/logo.tsx`, `components/common/theme-toggle.tsx`, `components/ui/select.tsx`; sửa `app/globals.css`, `app/layout.tsx`, `app/providers.tsx`, `components/ui/sonner.tsx`, `components/common/language-switcher.tsx`, `components/layout/{app-sidebar,app-header}.tsx`, `messages/{en,vi,id}.json`, `package.json` (+`next-themes`).
- **Còn dở / ghi chú:**
  - Theme mới chỉ toggle sáng↔tối; chưa có mục "Theo hệ thống" trong UI (init vẫn = system).
  - Cờ "en" dùng Union Jack (UK) — đổi nếu muốn cờ khác.

### 2026-07-07 — Layout shell: Header + Sidebar thu gọn (route group `(app)`)
- **Thay đổi:**
  - Cài shadcn `sidebar` (kéo theo `separator`, `sheet`, `tooltip`, `input`, `skeleton`, hook `hooks/use-mobile.ts`). Giữ nguyên `button` cũ.
  - Route group `app/(app)/` chứa shell: `app/(app)/layout.tsx` = `SidebarProvider` (đọc cookie `sidebar_state` giữ trạng thái thu gọn, chống nhấp nháy SSR) + `AppSidebar` + `SidebarInset` (là `<main>`) chứa `AppHeader` + children. Chuyển trang chủ `app/page.tsx` → `app/(app)/page.tsx` (bỏ `LanguageSwitcher` trùng vì header đã có).
  - `components/layout/app-sidebar.tsx` (client): `collapsible="icon"` — thu gọn về icon, tooltip khi thu gọn, highlight active theo `usePathname`, 6 mục CRM (Tổng quan/Khách hàng/Cơ hội/Công việc/Báo cáo/Cài đặt). `components/layout/app-header.tsx` (server): sticky, `SidebarTrigger` (phím tắt Ctrl/Cmd+B) + tên app + `LanguageSwitcher`. **Không footer.**
  - `TooltipProvider` mount ở `app/providers.tsx` (tooltip của sidebar cần provider — bản shadcn này không tự bọc).
  - i18n: thêm namespace `nav` vào `messages/{en,vi,id}.json`.
  - **Kiểm chứng:** `next build` PASS; `next start -p 3100` + curl `/` → HTTP 200, SSR render sidebar (`data-slot="sidebar"`) + nhãn tiếng Việt đúng, không lỗi `IntlError`/`MISSING_MESSAGE`.
- **File ảnh hưởng:** thêm `app/(app)/{layout,page}.tsx`, `components/layout/{app-sidebar,app-header}.tsx`, `components/ui/{sidebar,sheet,separator,tooltip,input,skeleton}.tsx`, `hooks/use-mobile.ts`; sửa `app/providers.tsx`, `messages/{en,vi,id}.json`; xóa `app/page.tsx`.
- **Còn dở / ghi chú:**
  - Route nav (`/contacts`, `/deals`, `/tasks`, `/reports`, `/settings`) chưa dựng → hiện 404; dựng dần theo tính năng.
  - Chưa có user menu/avatar ở header (YAGNI — thêm khi có auth).
  - ⚠️ Cổng 3000 đang bị dự án khác (`C:\PRJ-MEGA\MKT-MEGA`) chiếm — verify LAVIAN-CRM phải chạy cổng khác (đã dùng 3100).

### 2026-07-07 — Design token ClickUp + sonner toast
- **Thay đổi:**
  - **Kế thừa design token ClickUp toàn dự án** qua `app/globals.css`: remap biến shadcn sang bảng màu ClickUp (primary tím `#7b68ee`, neutral ClickUp, `--radius: 0.5rem`/8px, ring/accent tím). Giữ cấu trúc biến shadcn nên MỌI component đọc token tự động đổi theo — không sửa từng component.
  - Thêm token semantic + đăng ký trong `@theme inline` (dùng được như utility `bg-success`, `text-priority-urgent`…): `--success/--warning/--info` (+`-foreground`), `--destructive-foreground`, và bộ priority ClickUp `--priority-{urgent,high,normal,low}`. Có cả biến sáng (`:root`) lẫn tối (`.dark`).
  - **Toast = sonner** (`sonner@2.0.7`): `components/ui/sonner.tsx` (Toaster wrapper đọc token qua CSS var, `richColors` + `closeButton`, chưa gắn `next-themes`), mount `<Toaster />` trong `app/providers.tsx`. Dùng: `import { toast } from "sonner"`.
  - **Icon = lucide-react** (`^1.23.0`, đã cài từ trước) — không đổi.
  - **Kiểm chứng:** `next build` PASS.
- **File ảnh hưởng:** `app/globals.css`, `app/providers.tsx`, `components/ui/sonner.tsx`, `package.json` (+`sonner`).
- **Còn dở / ghi chú:**
  - Chưa cài `next-themes` → chưa có toggle dark mode (token `.dark` đã sẵn sàng, chỉ cần bật class `.dark` + `ThemeProvider` khi làm).
  - Màu semantic solid (success/info) là AA-large — hợp badge/nút chữ đậm; nếu cần dùng cho body text nhỏ nên đổi sang biến thể tint nhạt.
  - Chưa có component Badge/Priority/Status — token đã có sẵn để dựng khi cần.

### 2026-07-07 — Nền tảng CRM: i18n + xử lý lỗi + trang lỗi/404 + cấu trúc thư mục
- **Thay đổi:**
  - **i18n 3 ngôn ngữ** (en/vi/id) bằng `next-intl@4` chế độ cookie (URL không đổi). `i18n/config.ts`, `i18n/request.ts`, `i18n/actions.ts` (`setLocale` ghi cookie + `revalidatePath`), `messages/{en,vi,id}.json`. `next.config.ts` bọc `createNextIntlPlugin`. `layout.tsx` thêm `NextIntlClientProvider` + `<html lang>` động. `LanguageSwitcher` (native `<select>`) gắn vào `page.tsx`.
  - **Xử lý lỗi tập trung:** `lib/errors/index.ts` (`AppError`, `isAppError`, `normalizeError`), `lib/api/client.ts` (Axios + interceptor normalize), `types/index.ts` (`AppErrorShape`, re-export `Locale`).
  - **Trang lỗi/404:** `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` (Next 16 `unstable_retry`), `components/common/error-state.tsx`.
  - **Kiểm chứng:** `next build` PASS; self-check `lib/errors/errors.test.ts` (`node --test`) 5/5 pass; curl xác minh đổi ngôn ngữ (en/vi/id) + 404 render đúng theo locale.
  - Kế hoạch openspec: `openspec/changes/setup-crm-foundation/` (proposal/design/specs/tasks, đã tick hết) — **chưa archive**.
- **File ảnh hưởng:** `next.config.ts`, `tsconfig.json` (exclude `*.test.ts`), `app/{layout,page,not-found,error,global-error}.tsx`, `i18n/*`, `messages/*`, `lib/{errors,api}/*`, `types/index.ts`, `components/common/*`, `package.json` (+`next-intl`).
- **Còn dở / ghi chú:**
  - Chưa `openspec archive setup-crm-foundation` (làm khi chốt).
  - `global-error.tsx` nằm ngoài i18n provider → text tĩnh song ngữ (giới hạn Next đã biết).
  - Helper format tiền tệ/ngày: **hoãn** (YAGNI) — dùng `useFormatter` của next-intl khi có trang số liệu.

### 2026-07-07 — Setup codebase (Next.js + Tailwind + shadcn + React Query + Supabase)
- **Thay đổi:**
  - Cài `@supabase/supabase-js` + `@supabase/ssr`.
  - `npx shadcn init -b radix -p nova` (style `radix-nova`, neutral, Lucide) + thêm component `button`. Kéo theo: `class-variance-authority`, `tailwind-merge`, `clsx`, `lucide-react`, `tw-animate-css`, `shadcn`. shadcn ghi đè `app/globals.css` (token màu oklch + dark mode qua class `.dark`).
  - Sửa mismatch font: `layout.tsx` đổi biến Geist sang `--font-sans` cho khớp `@theme` của shadcn.
  - Wire React Query Provider vào `layout.tsx` (`lang="vi"`, metadata LAVIAN CRM). Thay `page.tsx` boilerplate bằng trang tối giản render `<Button>`.
  - Supabase SSR: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (async cookies getAll/setAll), `proxy.ts` (refresh session — bản Next.js 16 của middleware, gọi `getClaims()`).
  - `.env.example` (commit được nhờ `!.env.example` trong `.gitignore`) + `.env.local` (placeholder).
  - `next build` PASS (TypeScript OK, Proxy được nhận diện).
- **File ảnh hưởng:** `package.json`, `components.json`, `lib/utils.ts`, `lib/supabase/{client,server}.ts`, `proxy.ts`, `app/{layout,page,providers,globals.css}.tsx/css`, `components/ui/button.tsx`, `.env.example`, `.env.local`, `.gitignore`.
- **Còn dở / ghi chú:**
  - **Phải điền giá trị thật vào `.env.local`** (URL + publishable key) thì Supabase mới chạy.
  - Chưa tạo Zustand store nào (YAGNI — tạo khi có nhu cầu, gợi ý đặt ở `lib/store/`).
  - Chưa có auth flow (login/logout/callback) — `proxy.ts` mới chỉ refresh session, chưa redirect. Chưa bật dark-mode toggle (chưa cài `next-themes`).
  - ⚠️ Lưu ý môi trường: Bash và PowerShell **dùng chung cwd** — `cd` trong Bash làm lệch cwd PowerShell (đã gây cài nhầm 1 lần). Luôn `Set-Location` về root hoặc truyền path tường minh khi chạy npm/npx.

### 2026-07-07 — Khởi tạo quy tắc & memory bank
- **Thay đổi:** Cấu hình `CLAUDE.md` (trả lời tiếng Việt; quy trình openspec + ui-ux-pro-max + supabase + ponytail khi code/fix bug). Tạo memory bank.
- **File ảnh hưởng:** `CLAUDE.md`, `memory-bank/README.md`
- **Còn dở / ghi chú:** Chưa có tính năng nghiệp vụ. Session sau đọc file này trước khi bắt đầu.
