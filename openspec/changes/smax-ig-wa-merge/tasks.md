## 1. Gộp khách IG ↔ WA theo SĐT

- [x] 1.1 `lib/smax-inbox.ts`: `normPhone`, `findPhones`, `igPhoneIndex`; `byCustomer(threads, igByPhone)` gộp theo SĐT, kênh = phần xuất hiện trước
- [x] 1.2 `buildInboxReport` / `buildFollowupReport` / `countPotential` nhận `igByPhone`; lọc khách mới sau bước gộp; KH tiềm năng chỉ tính khách lần đầu xuất hiện trong kỳ
- [x] 1.3 `lib/smax-threads.ts`: tuỳ chọn `pages`; `fetchIgByPhone` (IG lùi 30 ngày + quét tin nhắn khách IG có tag chuyển đổi mà thiếu số); `lib/smax-messages.ts` tách lấy tin theo page + tid
- [x] 1.4 Gắn vào action Smax report + Marketing
- [x] 1.5 Test (gộp, kênh nhắn trước, IG ngoài kỳ, tìm số trong tin) + đo số thật trước/sau
