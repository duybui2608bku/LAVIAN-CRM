## Why

Khách bấm quảng cáo IG, để lại số trong chat IG rồi chuyển sang WhatsApp nhắn và chốt booking. SMAX coi đó là 2 khách khác nhau (khách IG + khách WA), nên báo cáo:

- đếm 2 khách mới (1 IG + 1 WA);
- booking gắn bên WA bị tính cho kênh WA, không về IG / chiến dịch IG;
- gắn Booking cả 2 bên thì đếm 2 booking.

Đo dữ liệu thật 01/10–18/11: 69 khách IG có hội thoại WA cùng số (63 cặp IG trước, trung vị cách ~16 giờ); booking gắn bên WA 8, gắn cả 2 bên 3. Không có số nào trùng giữa 2 khách IG khác nhau hay trùng số WA của spa → ghép theo SĐT đáng tin.

## What Changes

1. **Gộp khách IG ↔ WA theo SĐT:** khách WA (id `62…@s.whatsapp.net`) có số trùng SĐT của khách IG → coi là 1 người. Tag, thời điểm gắn tag, nhân viên của 2 bên gộp lại; tin nhắn cuối = mới nhất của 2 bên.
2. **Kênh nguồn = kênh khách nhắn trước** (lần đầu xuất hiện sớm hơn). IG trước → tính IG (kể cả booking gắn bên WA), chiến dịch theo `ad_id` IG. WA trước → giữ WA.
3. **Nhìn lùi 30 ngày hội thoại IG** trước ngày bắt đầu kỳ, để khách nhắn IG kỳ trước rồi sang WA kỳ này không thành "khách mới WA" (11/63 cặp cách nhau > 7 ngày).
4. **SĐT SMAX bỏ sót:** khách IG có tag `phone` / `booking` / `bookings-deposit` / `purchase` mà SMAX không lưu số → đọc 20 tin gần nhất của khách tìm số Indonesia (đo: 6/12 khách như vậy có số trong chat, cả 6 khớp WA). Mỗi tháng chỉ ~10 hội thoại → ít lượt gọi.
5. **KH tiềm năng (Marketing)** dùng cùng cách gộp và chỉ tính khách **lần đầu xuất hiện trong kỳ** (cùng quy tắc "khách mới" của Smax report) — tránh tính lại người đã là khách IG kỳ trước.

## Impact

- `lib/smax-inbox.ts` (`byCustomer` gộp theo SĐT, `igPhoneIndex`, `findPhones`; `buildInboxReport` / `buildFollowupReport` / `countPotential` nhận chỉ mục SĐT IG) + test.
- `lib/smax-threads.ts` (`pages` cho truy vấn, `fetchIgByPhone`), `lib/smax-messages.ts` (tách lấy tin theo page + tid).
- `app/(app)/customers/smax-report/actions.ts`, `app/(app)/marketing/actions.ts`.
- Không đổi DB, không đổi UI.

## Giới hạn

- Chỉ ghép được khi có SĐT: SMAX tự lưu, hoặc khách đã có tag chuyển đổi và số nằm trong 20 tin gần nhất. Khách IG chưa gắn tag, SMAX không lưu số → không ghép.
- Facebook "tin nhắn" (Dashboard) do FB đếm — không gộp được.
