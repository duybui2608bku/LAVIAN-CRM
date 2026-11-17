## Why

Rà lại toàn bộ cách đếm SMAX sau lỗi Booking 17/11 (khách cũ nhắn lại bị tính booking mới). Tìm thêm 3 lỗi cùng loại.

## What Changes

1. **Follow up sót chuyển đổi khi xem ngày cũ:** chỉ lấy hội thoại có tin nhắn cuối trong kỳ → khách gắn Booking/Purchase trong kỳ rồi nhắn tiếp sau kỳ bị rơi (16/11 sót 8). Giờ lấy tin nhắn từ đầu kỳ tới hôm nay; hội thoại thuộc kỳ nếu tin nhắn cuối trong kỳ HOẶC gắn Booking/Purchase trong kỳ; bỏ khách xuất hiện sau kỳ.
2. **1 khách IG bị đếm 2 lần:** khách IG có 2 hội thoại (tin nhắn + bình luận) dùng chung tag của khách (30 ngày: 225 khách). Gộp theo `customer.id` (ưu tiên hội thoại có tag) ở Báo cáo Smax, Follow up, cột KH tiềm năng Marketing.
3. **Khách cũ bình luận lại bị tính khách mới:** "mới/cũ" xét theo lần đầu khách xuất hiện = min(`created_at` hội thoại, `customer.created_at`).
4. **Deposit:** cọc gắn sau kỳ không tính vào deposit của kỳ.
- Nhãn thẻ "Hội thoại mới" → "Khách mới".

## Impact

- `lib/smax-inbox.ts` (`byCustomer`, `firstSeen`, `buildInboxReport`, `buildFollowupReport`, `countPotential`), test, `app/(app)/customers/smax-report/actions.ts`, `messages/{vi,en}.json`.
- Sau sửa, Booking 2 trang khớp nhau: 17/11 = 3, 16/11 = 13, 10–16/11 = 83.

## Giới hạn còn lại (do dữ liệu SMAX)

- Tag Potential/Follow up/Pending/Spam là trạng thái HIỆN TẠI, không phải trạng thái cuối ngày đã chọn.
- SMAX chỉ có tin nhắn cuối → xem kỳ cũ, "Số bào" thiếu khách nhắn trong kỳ rồi nhắn tiếp sau kỳ mà không chuyển đổi.
- SMAX chỉ lưu lần gắn gần nhất của mỗi tag.
