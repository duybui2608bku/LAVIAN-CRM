## Why

Dự án mới có nền tảng kỹ thuật (Next.js 16 + Supabase + React Query) nhưng chưa có: đa ngôn ngữ, quy ước thư mục, cách xử lý lỗi thống nhất, và các trang lỗi/404. Thiết lập các nền tảng này trước khi làm tính năng nghiệp vụ để tránh phải refactor toàn bộ về sau.

## What Changes

- Thêm **i18n 3 ngôn ngữ** (Anh/Việt/Indonesia) bằng `next-intl` chế độ cookie — URL **không đổi**, không dùng `[lang]` segment. Có bộ chuyển ngôn ngữ (language switcher) lưu lựa chọn vào cookie.
- Thêm **quy ước thư mục chuẩn**: `types/`, `lib/api/` (Axios instance + error interceptor), `lib/errors/`, `messages/` (file dịch), `components/common/`.
- Thêm **xử lý lỗi tập trung**: một kiểu lỗi chuẩn hoá (`AppError`) + hàm `normalizeError()` gom lỗi Axios/Supabase/Zod về một dạng, dùng chung cho toàn app.
- Thêm **trang lỗi & 404**: `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` (dùng `unstable_retry` — breaking change của Next 16).
- Thêm **vài component dùng chung tối thiểu** thực sự cần cho các trang lỗi/switcher (không scaffold thừa).

## Capabilities

### New Capabilities
- `i18n`: chọn/ghi nhớ ngôn ngữ qua cookie (Anh/Việt/Indonesia), nạp bản dịch trên server, hiển thị nội dung theo locale, và bộ chuyển ngôn ngữ.
- `error-handling`: chuẩn hoá lỗi từ nhiều nguồn về một dạng, ranh giới lỗi (error boundary) và trang 404 hiển thị thông điệp theo ngôn ngữ.

### Modified Capabilities
<!-- Không có: chưa có spec nghiệp vụ nào tồn tại. -->

## Impact

- **Dependencies:** thêm `next-intl` (và `axios` đã có sẵn cho `lib/api`).
- **Config:** `next.config.ts` bọc `createNextIntlPlugin`; thêm `i18n/request.ts`, `i18n/config.ts`.
- **Code:** `app/layout.tsx` (thêm `NextIntlClientProvider`, `lang` động); `proxy.ts` (giữ nguyên — cookie không cần redirect); thư mục mới `types/`, `lib/api/`, `lib/errors/`, `messages/`, `components/common/`.
- **Không breaking** với code hiện có (chưa có tính năng nghiệp vụ nào).
