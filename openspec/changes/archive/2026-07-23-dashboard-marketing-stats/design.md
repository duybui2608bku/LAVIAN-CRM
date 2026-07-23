# Design: dashboard-marketing-stats

## Context

Trang chủ `app/(app)/page.tsx` đang là server component render bảng pivot doanh thu theo dịch vụ. Thay bằng dashboard funnel marketing: 6 stat cards theo date range, dữ liệu từ 3 nguồn với 3 định dạng ngày khác nhau. Token `FB_TOKEN`/`SMAX_TOKEN` là secret — chỉ được đọc phía server.

## Goals / Non-Goals

**Goals:**
- 6 stat cards đúng số liệu theo range ngày VN (UTC+7), đổi range → số cập nhật.
- Lỗi từng nguồn (FB/SMAX) cô lập — card hiện "—" + message, các card khác vẫn có số.
- Không lộ token ra client.

**Non-Goals:**
- Không vẽ chart/biểu đồ theo ngày (chỉ số tổng) — thêm sau khi cần.
- Không cache/cron số liệu — fetch trực tiếp mỗi lần đổi range.
- Không cấu hình danh sách tài khoản ads qua UI — hardcode 2 account id.

## Decisions

1. **Server action `getMarketingStats(from, to)`** (from/to = `YYYY-MM-DD` ngày VN) trả `{ spend, messages, leads, appointments, visited, errors }` — client component gọi qua `useTransition` khi đổi range. Chọn server action thay route handler: khớp pattern toàn dự án, không cần endpoint public.
   - Action check đăng nhập (`supabase.auth.getUser()`) trước khi fetch — trang nằm sau proxy nhưng server action là POST endpoint công khai, không check thì lộ số liệu.
2. **Đổi ngày 3 hệ — thuần string, KHÔNG dùng `Date` timezone** (server có thể chạy UTC, không tin `getTimezoneOffset`):
   - FB: `time_range={"since":from,"until":to}` — giữ nguyên `YYYY-MM-DD` (FB hiểu theo timezone tài khoản ads, tài khoản đặt giờ VN). Version `v25.0` (docs hiện hành).
   - SMAX: ngày VN bắt đầu lúc `17:00:00 +00:00` hôm trước → `from = addDays(from, -1) + " 17:00:00 +00:00"`, `to = to + " 16:59:59 +00:00"`. `addDays` dùng `Date.UTC` (chỉ số học ngày, không dính timezone máy).
   - Supabase: `scheduled_at >= addDays(from,-1)T17:00:00Z` và `< toT17:00:00Z` (nửa mở — trọn ngày VN, không hở giây).
3. **FB spend:** `GET graph.facebook.com/v25.0/act_{id}/insights?fields=spend&time_range=...&access_token=...` cho từng account (Promise.all 2 account), cộng `Number(data[0]?.spend ?? 0)`. `data` rỗng (không chạy ads trong range) = 0, không phải lỗi. 1 trong 2 account lỗi → cả card spend báo lỗi (số thiếu 1 account là số sai, thà không hiện).
4. **SMAX:** `POST https://api.smax.ai/bizs/lavianbeautycenter/statistics-v2/customers`, header `Authorization: Bearer {SMAX_TOKEN}`, payload giữ nguyên mẫu user cung cấp (chỉ thay `from`/`to`) — lấy `data.customer_message_total` + `data.customer_lead_total`.
5. **Supabase đếm** bằng `select("id", { count: "exact", head: true })`: `appointments` lọc `scheduled_at` trong range + `deleted_at is null`; `customers` lọc `stage = 'visited'` + `created_at` trong range + `deleted_at is null`. Chọn `created_at` của khách (không phải mốc check-in) vì card đo "khách của khoảng thời gian này đã đến" — khớp funnel cùng gốc thời gian với 5 card kia.
6. **UI:** page server component chỉ render khung + `<MarketingStats />` (client). Client giữ state range (mặc định hôm nay theo giờ máy user — user ở VN), gọi action trong `useEffect`-less flow: gọi lần đầu + mỗi lần đổi range qua `useTransition`. Card: grid `sm:2 xl:3` cột, mỗi card = label + số to + phụ chú (icon Lucide, style token sẵn có, KHÔNG thêm lib). "Chi tiêu/tin nhắn" tính tại client từ 2 số đã có.
7. **Format tiền:** spend FB trả về theo currency tài khoản (VND) → format `formatVnd` sẵn có.

## Risks / Trade-offs

- [FB account không đặt timezone VN] → số spend lệch ngày; chấp nhận — timezone tài khoản là cấu hình bên FB, ghi chú trong code.
- [SMAX auth header có thể không phải Bearer] → nếu 401, thử `access-token` header; xử lý khi test thật (card hiện lỗi, không sập trang).
- [Đếm "Đã đến" theo stage hiện tại × created_at] → khách cũ (tạo trước range) đến trong range không được đếm; đo theo mốc check-in lịch hẹn sẽ khác nghĩa — chốt theo yêu cầu "visited enums", đổi sau nếu user muốn.
- [Server action fetch 2 API ngoài mỗi lần đổi range] → chậm ~1-2s; chấp nhận, có skeleton/spinner. Cache thêm khi thành vấn đề.
