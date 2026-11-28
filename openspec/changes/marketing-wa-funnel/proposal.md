## Why
Số KH tiềm năng / Đặt lịch theo **chiến dịch** đang sai (nhiều chiến dịch dùng chung 1 số WA nên số bị lặp, gán chiến dịch chưa chuẩn). Số theo **số WA** thì tin được hơn — xem theo số WA thay cho theo chiến dịch.

## What Changes
- Bảng chiến dịch (desktop + mobile) **ẩn 4 cột**: KH tiềm năng, Đặt lịch, Tỉ lệ đặt lịch, Chi tiêu / Đặt lịch. Giữ Đến cơ sở.
- Khối "Tin nhắn theo số WA" → **"Theo số WA"**: mỗi thẻ WA-xxxx hiện Tin nhắn (số lớn) + KH tiềm năng, Đặt lịch (· tỉ lệ so với tin nhắn), Chi tiêu / Đặt lịch. Phễu lấy từ `potential.byWa` (khách nhắn vào số đó); chi tiêu = tổng chi tiêu các chiến dịch mang số đó. "Chưa gắn WA" chỉ có tin nhắn.
- Thẻ tổng ở đầu trang giữ nguyên.

## Impact
- `components/marketing/ads-stats.tsx`, `lib/wa.ts` (`summarizeByWa` cộng thêm `spend`), `lib/wa.test.ts`, `messages/{vi,en}.json` (`byWa`, +`messagesUnit`). Không đổi DB.
