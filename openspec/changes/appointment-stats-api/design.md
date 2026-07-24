## Context

Trang báo cáo `/` đã có card lịch hẹn (total/today/tomorrow) lấy từ `getMarketingStats` — server action gác admin, số "today/tomorrow" trộn trong response lớn, không có tăng trưởng, không có chỉ số "lịch phát sinh từ khách mới". Đã có sẵn pattern API thống kê: `app/api/finance/revenue/route.ts` (requireAdmin, `supaRange`, growth so kỳ liền trước qua `getGrowthRate`).

## Goals / Non-Goals

**Goals:**
- 1 route handler `GET /api/appointments/summary?from&to` — `from`/`to` tùy chọn, mặc định **hôm nay giờ VN** (`Asia/Ho_Chi_Minh`); `selected`/`newCustomer` theo khoảng chọn, `tomorrow` cố định ngày mai VN.
- 3 chỉ số + `previousCount` + `growthPercent` cùng kỳ liền trước cùng độ dài.
- Tái dùng tối đa helper sẵn có, 1 file mới duy nhất.

**Non-Goals:**
- KHÔNG đổi UI/dashboard (gắn card dùng API này là việc sau, làm khi user yêu cầu).
- KHÔNG thay `getMarketingStats`, không xóa `appointmentSummary` hiện có.
- KHÔNG thêm breakdown deposited/notDeposited (chưa được yêu cầu).
- KHÔNG migration DB.

## Decisions

1. **Hôm nay/ngày mai tính trong server theo `Asia/Ho_Chi_Minh`** bằng `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })` — copy đúng pattern `getMarketingStats`, không tin timezone máy. Range UTC nửa mở qua `supaRange(from, to)`. `from`/`to` từ query string, thiếu → mặc định hôm nay; validate `isValidDateRange` (lib/financial) → 400 như finance route.
2. **Định nghĩa 3 chỉ số:**
   - `selected`: `scheduled_at ∈ [from..to]`, `deleted_at is null` (không lọc status — khớp `appointmentSummary` hiện có). Label "hôm nay" hay "Lịch hẹn 25/9" do UI quyết bằng cách so `period.from/to` với `period.today` — API không trả label.
   - `newCustomer` ("lịch hẹn trong ngày"): `appointments.created_at ∈ [from..to]` **và** khách của lịch có `customers.created_at ∈ [from..to]` (khách mới) — join `customers!inner` + filter cột embedded, khách đã xóa mềm không tính.
   - `tomorrow`: `scheduled_at ∈ [ngày mai VN)` — CỐ ĐỊNH, không theo `from`/`to`.
3. **Cùng kỳ = kỳ liền trước cùng độ dài** qua `getPreviousFinancialRange` (lib/financial): `selected`/`newCustomer` so kỳ liền trước của khoảng chọn; `tomorrow` luôn so hôm nay VN (query riêng — khoảng chọn có thể khác hôm nay). Growth qua `getGrowthRate` — quy ước sẵn: previous=0 → 0% nếu current=0, ngược lại 100%.
4. **Đếm bằng `select(..., { count: "exact", head: true })`** — không kéo row, không dính cap 1.000 của PostgREST. 6 count query chạy `Promise.all` (selected + kỳ trước, newCustomer + kỳ trước, ngày mai, hôm nay).
5. **Gác đăng nhập, không cần admin**: dữ liệu lịch hẹn mọi user authenticated đọc được sẵn (RLS). Check `supabase.auth.getUser()` trả 401 khi chưa đăng nhập — nếu bỏ check, RLS trả count 0 âm thầm (số sai thay vì lỗi rõ).
6. **Shape response** theo pattern finance route: `{ data: { selected, newCustomer, tomorrow }, period: { from, to, previous: { from, to }, today, tomorrow, timezone } }`, mỗi chỉ số `{ count, previousCount, growthPercent }`; lỗi → `{ error: { code, message } }` qua `normalizeError`.

## Risks / Trade-offs

- [Lịch của khách mới nhưng tạo ngoài khoảng chọn không tính vào `newCustomer`] → chủ đích: chỉ số đo "phát sinh trong kỳ"; đổi định nghĩa khi user yêu cầu.
- [6 count query mỗi request, không cache] → số lượng bảng nhỏ, count head rẻ; thêm cache khi có số đo chậm thật.
- [Giả định FK embed `customers` filter được qua `customers.created_at`] → pattern `!inner` chuẩn PostgREST, đã dùng tương tự trong repo; smoke test bằng curl sau khi code.
