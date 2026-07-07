## 1. i18n nền tảng

- [x] 1.1 Cài `next-intl` (`npm i next-intl`)
- [x] 1.2 Tạo `i18n/config.ts`: `locales = ['en','vi','id']`, `defaultLocale = 'vi'`, `LOCALE_COOKIE = 'NEXT_LOCALE'`, type `Locale`
- [x] 1.3 Tạo `i18n/request.ts`: `getRequestConfig` đọc cookie, validate locale, `import('../messages/{locale}.json')`
- [x] 1.4 Tạo `messages/en.json`, `messages/vi.json`, `messages/id.json` với namespace `common`, `home`, `errors`
- [x] 1.5 Bọc `createNextIntlPlugin('./i18n/request.ts')` trong `next.config.ts`

## 2. Layout & chuyển ngôn ngữ

- [x] 2.1 Cập nhật `app/layout.tsx`: `getLocale()` cho `<html lang>`, bọc `NextIntlClientProvider`, giữ `Providers` bên trong
- [x] 2.2 Tạo Server Action `i18n/actions.ts` → `setLocale(locale)` ghi cookie + `revalidatePath('/', 'layout')`
- [x] 2.3 Tạo `components/common/language-switcher.tsx` (client) gọi `setLocale`
- [x] 2.4 Gắn `LanguageSwitcher` vào `app/page.tsx` để kiểm chứng đổi ngôn ngữ

## 3. Xử lý lỗi tập trung

- [x] 3.1 Tạo `lib/errors/index.ts`: class `AppError`, `isAppError()`, `normalizeError(unknown)` (Axios/Supabase/Zod/generic)
- [x] 3.2 Tạo `types/index.ts`: `Locale` re-export + `AppErrorShape`
- [x] 3.3 Tạo `lib/api/client.ts`: Axios instance + response interceptor `reject(normalizeError(err))`
- [x] 3.4 Self-check `lib/errors/errors.test.ts` (`node --test`) — 5/5 pass

## 4. Trang lỗi & 404

- [x] 4.1 Tạo `components/common/error-state.tsx` (UI lỗi + vùng hành động)
- [x] 4.2 Tạo `app/not-found.tsx` (Server Component, `getTranslations('errors')`, link về `/`)
- [x] 4.3 Tạo `app/error.tsx` (`'use client'`, props `{ error, unstable_retry }`, dùng `ErrorState`)
- [x] 4.4 Tạo `app/global-error.tsx` (`'use client'`, có `<html>/<body>`, text tĩnh song ngữ)

## 5. Kiểm chứng & chốt

- [x] 5.1 Chạy `next build` — PASS (TypeScript OK, next-intl plugin nhận diện)
- [x] 5.2 Chạy self-check ở 3.4 — PASS; xác minh runtime qua curl (en/vi/id + 404)
- [x] 5.3 Cập nhật `memory-bank/README.md` (mục nhật ký + trạng thái hiện tại)
