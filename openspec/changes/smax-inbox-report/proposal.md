## Why

Nhân viên Telesales đang tự đếm tay hội thoại SMAX mỗi ngày để làm bảng "Inbox destination" (WA/IG × Booking / Follow Up / Pending 24H). Dữ liệu đã có sẵn trong tag hội thoại SMAX → CRM tự tính được, cả báo cáo tổng lẫn theo từng nhân viên.

## What Changes

- Token: dùng env `SMAX_TOKEN` như các báo cáo SMAX khác (lấy từ `localStorage.smaxai_token` trên smax.ai, gán ở `.env.local` + Vercel).
- **Trang "Báo cáo Smax" `/customers/smax-report`** (quyền `customers.view`, menu Khách hàng → Danh sách | Báo cáo Smax). Bộ lọc: khoảng ngày + Telesales (lọc phía client, không gọi lại API).
  - Lấy toàn bộ hội thoại có tin nhắn trong khoảng ngày (`POST /bizs/lavianbeautycenter/threads`, page_pids = 6 số WA + IG, `limit` 200, phân trang `after = last_message_at`).
  - Kênh theo `platform`: `whatsappweb` → WA, `instagram` → IG.
  - Trạng thái theo `tag_aliases`: Booking = `booking` + `bookings-deposit` (deposit đếm riêng ở ghi chú), Follow Up = `follow-up`, Pending 24H = `no-reply`.
  - Nhân viên theo tag: Bulan, Ratih, Sabil, Angel, Zila, Tiara kania (+ dòng "Chưa gán").
  - 4 thẻ: Tổng hội thoại (kèm số chưa gắn trạng thái), Booking / Follow Up / Pending 24H (số + %, tách WA·IG, Booking kèm số deposit).
  - Bảng "Theo kênh": WhatsApp / Instagram / Tổng × trạng thái (số + % theo dòng).
  - Bảng "Theo Telesales" (khi chưa lọc): số theo trạng thái, Tổng, Tỉ lệ Booking, thanh phân bổ màu; bấm dòng = lọc theo người đó.

## Giới hạn

- Tag là **trạng thái hiện tại** của hội thoại — xem lại ngày cũ sẽ ra trạng thái bây giờ của các hội thoại có tin nhắn ngày đó (không phải ảnh chụp cuối ngày).
- Khoảng ngày tối đa 31 ngày.

## Impact

- `lib/smax-inbox.ts` (logic thuần + test), `lib/smax-threads.ts` (gọi API)
- `app/(app)/customers/smax-report/{page.tsx,actions.ts}`, `components/customers/smax-report-view.tsx`
- `components/layout/app-shell.tsx`, `messages/{vi,en}.json`
