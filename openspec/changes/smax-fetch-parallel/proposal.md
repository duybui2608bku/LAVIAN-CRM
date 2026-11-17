## Why

Báo cáo Smax / Follow up tải hội thoại SMAX tuần tự (200/trang, phân trang nối tiếp): 30 ngày ≈ 5.000 hội thoại = 26 request liên tiếp ≈ 20s (theo ngày tạo ≈ 12s).

## What Changes

- `lib/smax-threads.ts`: chia khoảng ngày thành lát 24h (mốc 00:00 WIB), tải các lát song song (8 luồng / truy vấn), phân trang tuần tự trong từng lát.
- `limit` 200 → 500 (SMAX từ chối 1000).
- Thử lại tối đa 3 lần khi SMAX trả 429/5xx hoặc rớt mạng (chạy song song cao dễ gặp 502).
- Không đổi kết quả: mỗi hội thoại có đúng 1 `created_at` / `last_message_at` nên rơi vào đúng 1 lát; vẫn bỏ trùng theo `id`.

## Impact

- Đo thật 2026-11-17 (30 ngày): Follow up 20s → ~3s (5006 hội thoại, khớp số cũ); Báo cáo Smax ~12s → ~2s (4399 mới + 145 booking, khớp số cũ).
- Không đổi API action, UI, DB.
