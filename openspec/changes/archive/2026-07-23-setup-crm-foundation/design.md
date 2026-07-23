## Context

Next.js 16 (App Router, không dùng `src/`, alias `@/*` = root). Middleware đã đổi thành `proxy.ts`; `cookies()` là async. Đã có Tailwind v4 + shadcn, React Query, Supabase SSR, react-hook-form + zod, zustand. Chưa có tính năng nghiệp vụ. `next-intl@4.13.1` khai báo hỗ trợ chính thức Next 16 + React 19.

## Goals / Non-Goals

**Goals:**
- i18n 3 ngôn ngữ (en/vi/id), lưu ở cookie, URL không đổi.
- Quy ước thư mục rõ ràng cho code nghiệp vụ về sau (`types/`, `lib/api/`, `lib/errors/`, `messages/`, `components/common/`).
- Một điểm chuẩn hoá lỗi duy nhất dùng chung.
- Trang 404 + error boundary theo ngôn ngữ.

**Non-Goals:**
- Không làm URL-based locale (`/vi`, `/en`) — đã chốt cookie-based.
- Không tạo component/store/hook "để dành". Chỉ tạo cái các trang lỗi/switcher thực sự dùng (ponytail).
- Không đụng auth flow, không thêm màn hình nghiệp vụ.

## Decisions

### 1. i18n: `next-intl` chế độ "without i18n routing" (cookie)
- `i18n/config.ts`: hằng `locales = ['en','vi','id']`, `defaultLocale = 'vi'`, tên cookie `NEXT_LOCALE`.
- `i18n/request.ts`: `getRequestConfig` đọc cookie `NEXT_LOCALE`, validate qua danh sách locales (sai → default), `import()` file `messages/{locale}.json`.
- `next.config.ts`: bọc `createNextIntlPlugin('./i18n/request.ts')`.
- `app/layout.tsx`: `const locale = await getLocale()`, đặt `<html lang={locale}>`, bọc `<NextIntlClientProvider>` (messages lấy từ `getMessages()`), giữ React Query Provider bên trong.
- Đổi ngôn ngữ: Server Action `setLocale(locale)` ghi cookie `NEXT_LOCALE` rồi `revalidatePath('/', 'layout')`. Component `LanguageSwitcher` (client) gọi action. Không đổi URL, không cần proxy redirect.
- **Vì sao next-intl thay vì dictionaries thuần:** cần format số/ngày/tiền tệ theo locale (CRM) + interpolation/plural sẵn có; peer dep đã hỗ trợ Next 16. Trade-off: +1 dependency (chấp nhận, người dùng đã chọn).

### 2. Cấu trúc thư mục
```
i18n/            config.ts, request.ts
messages/        en.json, vi.json, id.json
types/           index.ts (kiểu dùng chung: AppError shape, v.v.)
lib/api/         client.ts (Axios instance + interceptor gọi normalizeError)
lib/errors/      index.ts (AppError, normalizeError, isAppError)
components/common/  language-switcher.tsx, error-state.tsx
app/             not-found.tsx, error.tsx, global-error.tsx
```
Giữ nguyên `lib/supabase/`, `lib/utils.ts`, `components/ui/` đã có.

### 3. Xử lý lỗi tập trung
- `AppError`: class kế thừa `Error` với `code: string`, `status?: number`, `message` (đã thân thiện).
- `normalizeError(err): AppError` — nhận `unknown`, phân nhánh: `AppError` (trả về nguyên), Axios error (đọc `response.status` + message), Supabase `PostgrestError`/`AuthError` (đọc `.message`/`.code`), Zod error (gộp `issues`), còn lại → generic. Luôn trả `AppError`, không bao giờ ném thêm.
- `lib/api/client.ts`: Axios instance, response interceptor `err => Promise.reject(normalizeError(err))` → mọi caller nhận `AppError` đồng nhất.
- Các `error.tsx`/`global-error.tsx` hiển thị `error.message` (đã normalize khi ném từ data-layer) + nút `unstable_retry`.

### 4. Trang lỗi & 404 (Next 16)
- `app/not-found.tsx`: Server Component, text từ `getTranslations('errors')`, link về `/`.
- `app/error.tsx`: `'use client'`, nhận `{ error, unstable_retry }` (KHÔNG phải `reset` — breaking Next 16), dùng `useTranslations`.
- `app/global-error.tsx`: `'use client'`, có `<html>/<body>` riêng; **không** dùng `useTranslations` (nằm ngoài provider) → text tĩnh song ngữ tối giản hoặc tiếng Anh mặc định.

### 5. Components dùng chung (tối thiểu)
- `LanguageSwitcher`: nút chọn en/vi/id (dùng shadcn `button`/`dropdown` nếu đã có; nếu chưa có dropdown thì `select` native — rung 4 ponytail).
- `ErrorState`: khối UI hiển thị lỗi + nút thử lại, tái dùng trong `error.tsx` và các trang nghiệp vụ sau.
- Không tạo thêm (Card/Table/Modal…) cho tới khi có trang thật cần.

## Risks / Trade-offs

- **next-intl + Turbopack Next 16** có thể phát sinh cảnh báo dù peer dep hợp lệ → Mitigation: chạy `next build` sau khi wire; nếu plugin lỗi, fallback tạm về dictionaries thuần (đọc cookie trong Server Component) — cùng cấu trúc `messages/`, ít rework.
- **`global-error.tsx` ngoài phạm vi i18n provider** → chấp nhận text tĩnh (tài liệu Next xác nhận đây là giới hạn đã biết).
- **Cookie switch cần `revalidatePath`** để Server Components đọc lại → nếu quên, UI không đổi ngôn ngữ. Có ghi rõ trong tasks.

## Migration Plan

Thay đổi thuần bổ sung, không có dữ liệu cũ để migrate. Rollback = gỡ `next-intl` + hoàn `next.config.ts`/`layout.tsx`. Verify bằng `next build` PASS.

## Open Questions

- Có cần format tiền tệ/ngày tập trung (helper `formatCurrency`/`formatDate`) ngay không? → Đề xuất **hoãn** tới khi có trang hiển thị số liệu (YAGNI); next-intl đã có sẵn `useFormatter` khi cần.
