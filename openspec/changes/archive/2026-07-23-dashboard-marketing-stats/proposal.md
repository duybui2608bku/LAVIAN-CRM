# Proposal: dashboard-marketing-stats

## Why

Trang chủ hiện tại là bảng pivot doanh thu theo dịch vụ — không trả lời được câu hỏi vận hành hằng ngày: chi bao nhiêu tiền quảng cáo, đổi lại bao nhiêu tin nhắn / số điện thoại / lịch hẹn / khách đến. Cần một dashboard funnel marketing theo khoảng ngày, gom số liệu từ 3 nguồn (Facebook Ads, SMAX, Supabase).

## What Changes

- **BREAKING (UI):** Bỏ bảng pivot doanh thu theo dịch vụ ở `app/(app)/page.tsx` (dashboard cũ) — thay bằng dashboard thống kê marketing.
- Dashboard mới gồm **6 stat cards** theo **date range** (mặc định: hôm nay, giờ VN):
  1. **Chi tiêu** — Facebook Graph API `/act_{id}/insights?fields=spend`, cộng 2 tài khoản `act_1494701561142295` + `act_3723515967967924` (token `FB_TOKEN`, server-only).
  2. **Khách nhắn tin** — SMAX `POST /bizs/lavianbeautycenter/statistics-v2/customers` → `customer_message_total` (token `SMAX_TOKEN`, server-only).
  3. **Chi tiêu / tin nhắn** — tự tính = Chi tiêu ÷ Khách nhắn tin (0 tin nhắn → hiển thị "—").
  4. **Để lại số** — SMAX `customer_lead_total`.
  5. **Lịch hẹn** — đếm `appointments` có `scheduled_at` trong range (bỏ lịch xóa mềm).
  6. **Đã đến** — đếm `customers` stage `visited` có `created_at` trong range (enum stage `visited` = "Đã đến").
- Chuyển đổi ngày cho 3 hệ từ range `YYYY-MM-DD` (ngày VN, UTC+7):
  - FB: `time_range={"since","until"}` dạng `YYYY-MM-DD` (inclusive, theo timezone tài khoản ads — tài khoản đặt giờ VN).
  - SMAX: `from = (ngày bắt đầu − 1) 17:00:00 +00:00`, `to = ngày kết thúc 16:59:59 +00:00`.
  - Supabase: ISO UTC (`từ 00:00 VN` → `T17:00:00Z` hôm trước, đến `23:59:59 VN`).
- Lỗi từng nguồn không đánh sập trang: card nguồn lỗi hiển thị "—" + thông báo lỗi nhỏ.

## Capabilities

### New Capabilities

- `marketing-dashboard`: dashboard funnel marketing theo date range — 6 stat cards từ FB Ads / SMAX / Supabase, quy đổi timezone VN cho 3 định dạng ngày khác nhau.

### Modified Capabilities

_(không có — dashboard cũ chưa có spec; các capability khác không đổi requirement)_

## Impact

- `app/(app)/page.tsx` — viết lại (bỏ pivot doanh thu).
- Mới: `lib/marketing.ts` (đổi ngày 3 hệ + fetch FB/SMAX, server-only), `app/(app)/actions.ts` (server action lấy stats theo range), `components/dashboard/marketing-stats.tsx` (client: DateRangePicker + grid cards).
- Env: dùng `FB_TOKEN`, `SMAX_TOKEN` (đã có trong `.env.example`) — chỉ đọc phía server.
- i18n: namespace `dashboard` mới ×3 locale.
- Không đổi DB/schema/RLS — chỉ 2 query đếm (`appointments`, `customers`) qua client Supabase hiện có.
