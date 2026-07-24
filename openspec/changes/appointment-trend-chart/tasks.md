## 1. API xu hướng

- [x] 1.1 Tạo `app/api/appointments/trend/route.ts`: gác đăng nhập (`supabase.auth.getUser()` → 401), đọc `to` (mặc định hôm nay VN qua `Intl`), validate bằng `isValidDateRange(to, to)` → 400, dựng 7 ngày bằng `addDays`
- [x] 1.2 `Promise.all` 21 head-count (`{ count: "exact", head: true }` + `supaRange(day, day)`): customers.created_at / appointments.scheduled_at / appointments.checked_in_at, lỗi bất kỳ → throw
- [x] 1.3 Response `{ data: [{ date, data, appointments, visited }], period: { from, to, days, today, timezone } }`; catch → `normalizeError` shape `{ error: { code, message } }`

## 2. UI dashboard

- [x] 2.1 `marketing-stats.tsx`: state + fetch `/api/appointments/trend?to=...` trong `Promise.all` sẵn có
- [x] 2.2 Bọc section lịch hẹn + section xu hướng trong `grid xl:grid-cols-2`; nén 3 card lịch hẹn (padding/typo nhỏ hơn, hint → `title`, deposit về 1 dòng)
- [x] 2.3 Component `TrendChart` thuần CSS: cột nhóm 3 series, legend, `title`/`aria-label` từng cột, trạng thái loading + lỗi
- [x] 2.4 i18n `trendSection` cho vi/en/id (series tái dùng `serviceData` / `appointments` / `serviceArrived`)

## 3. Kiểm chứng

- [x] 3.1 `npx tsc --noEmit` + `npm run lint` sạch (2 lỗi eslint còn lại là của `theme-toggle.tsx` / `use-mobile.ts`, có từ trước)
- [x] 3.2 Chạy thật 21 head-count qua REST secret key và đối chiếu với cách "kéo row rồi gom theo ngày VN" — khớp 7/7 ngày ở tuần có số liệu (15–18/07). Smoke test route: chưa đăng nhập → 401 đúng shape. CÒN THIẾU: gọi có session (cần đăng nhập browser) và soi giao diện thật
- [x] 3.3 Cập nhật `memory-bank/README.md` (mục nhật ký session)
