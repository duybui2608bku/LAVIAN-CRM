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
- **Danh mục Enum (admin):** bảng `public.enum_options` (kind ∈ stage/source/lost_reason, value + label 3 ngữ vi/en/id, sort_order, is_active) thay cho Postgres enum — admin CRUD ở `/enums`. Seed sẵn đủ giá trị mặc định. `types/customer.ts` (`EnumOption`). Customers lưu **giá trị text** của stage/source/lost_reason (không FK); nhãn tra theo locale bằng `lib/customers.ts` (`optionLabel`).
- **Khách hàng (mọi user):** bảng `public.customers` (identity full_name/phone/social_link; phân loại source/stage/lost_reason/staff_id; first_contact; `notes` jsonb `[{text,at}]`; system created/updated/deleted_at soft-delete). Trang `/customers` CRUD + lọc (stage/source/staff/khoảng ngày created_at) + tìm (tên/phone), lọc **client-side** (`matchesCustomerFilters`). **KHÔNG unique** (cho phép trùng, kể cả phone) — chỉ index thường. RLS: mọi authenticated toàn quyền customers; **thêm policy `profiles_select_authenticated`** để user đọc tên nhân viên. Dropdown/lọc dùng **shadcn Select**; ngày dùng **shadcn date picker** (`components/common/date-picker.tsx`: `DatePicker` đơn + `DateRangePicker` range) trên nền `react-day-picker`+`date-fns`; bộ lọc ngày = 1 **date range**; có nút **Tải lại**. `/enums` gác admin trong `proxy.ts`.

## Nhật ký session

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
