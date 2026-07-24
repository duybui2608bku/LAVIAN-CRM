## 1. Route handler

- [x] 1.1 Tạo `app/api/appointments/summary/route.ts`: check đăng nhập (`supabase.auth.getUser()` → 401), nhận `from`/`to` tùy chọn (mặc định hôm nay VN, validate `isValidDateRange` → 400), hôm nay/ngày mai giờ VN qua `Intl` + `addDays`, kỳ trước qua `getPreviousFinancialRange`
- [x] 1.2 6 count query `{ count: "exact", head: true }` chạy `Promise.all`: scheduled khoảng chọn / kỳ trước / ngày mai / hôm nay + newCustomer khoảng chọn / kỳ trước (join `customers!inner`, filter `customers.created_at`, khách chưa xóa mềm)
- [x] 1.3 Ghép response `{ data: { selected, newCustomer, tomorrow }, period: { from, to, previous, today, tomorrow, timezone } }` — mỗi chỉ số `{ count, previousCount, growthPercent }` dùng `getGrowthRate`; catch → `normalizeError` shape `{ error: { code, message } }`

## 2. Kiểm chứng

- [x] 2.1 `npx tsc --noEmit` + eslint sạch
- [x] 2.2 Smoke test: không session → 401 đúng shape (dev server); 2 dạng count query chạy thật trên Supabase qua REST secret key, embed filter xác nhận lọc 2 chiều (7→0 hẹp, 7 rộng). CÒN THIẾU: curl có session (cần đăng nhập browser) — đối chiếu số với /appointments khi có data hôm nay
- [x] 2.3 Cập nhật `memory-bank/README.md` (mục nhật ký session)
