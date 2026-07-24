## Why

Trang báo cáo `/` đã có 2 API mới (`/api/customers/funnel`, `/api/appointments/summary`) nhưng UI vẫn lấy số qua `getMarketingStats` gọi 2 lần. User yêu cầu dựng lại 2 section theo mẫu ảnh: **phễu công việc** dạng pipeline có mũi tên (Tin nhắn → Data → Booking → Khách đến, bỏ WhatsApp) và **lịch hẹn** 3 card (Trong ngày / Hôm nay / Ngày mai — bỏ Tổng số lịch hẹn), mỗi card lịch hẹn kèm Deposit / No deposit như ảnh.

## What Changes

- **Mở rộng `GET /api/appointments/summary`**: mỗi chỉ số kỳ hiện tại (`selected`, `newCustomer`, `tomorrow`) thêm `deposited` / `notDeposited` (lịch có ≥1 payment kind `deposit` — khớp định nghĩa `appointmentBreakdown` của `getMarketingStats`). Đếm bằng head-count + `appointment_payments!inner` nên không dính trần 1.000 row. Kỳ trước giữ nguyên count-only.
- **Section "Khách hàng" → grid phễu** (data từ `/api/customers/funnel`): 4 card nối mũi tên Khách nhắn tin → Để lại SĐT → Lịch hẹn → Đã đến; mỗi card có count, % so bước đầu (Khách nhắn tin), badge tăng trưởng so kỳ trước; dưới cùng dòng "Tổng chuyển đổi Khách nhắn tin → Đã đến: X%". Bỏ pie chart cũ (trùng số liệu).
- **Section "Lịch hẹn" → 3 card từ API** (data từ `/api/appointments/summary`): Lịch hẹn trong ngày (từ khách mới trong kỳ), Lịch hẹn hôm nay (**label linh hoạt** — chọn ngày khác thì thành "Lịch hẹn 25/09"), Lịch hẹn ngày mai (cố định, growth so với hôm nay). Mỗi card: count, badge tăng trưởng, thanh + số Deposit / No deposit. Bỏ card "Tổng lịch hẹn".
- `getMarketingStats` vẫn dùng cho spend (trang marketing), staff, reply-time; bỏ lần gọi kỳ trước khi không cần spend.
- i18n vi/en/id cho label mới.

## Capabilities

### New Capabilities
- `dashboard-funnel-grid`: Grid phễu + lịch hẹn trên trang báo cáo lấy số từ 2 API thống kê.

### Modified Capabilities
- `appointment-stats-api`: thêm breakdown đặt cọc cho các chỉ số kỳ hiện tại (change gốc chưa archive — delta viết dạng ADDED requirement riêng).

## Impact

- Sửa: `app/api/appointments/summary/route.ts`, `components/dashboard/marketing-stats.tsx`, `messages/{vi,en,id}.json`.
- Không migration, không đổi `getMarketingStats`, không đổi funnel API.
