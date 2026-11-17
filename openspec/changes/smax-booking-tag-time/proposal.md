## Why

Thẻ Booking ở Báo cáo Smax đếm hội thoại có tag Booking và có tin nhắn trong kỳ → khách đã booking từ hôm trước, hôm nay nhắn lại (hỏi giờ, xác nhận lịch) bị tính thêm lần nữa. Ví dụ 17/11: hiện 12, thực tế chỉ 3 booking được gắn trong ngày.

## What Changes

- Booking = hội thoại có lần gắn tag `booking`/`bookings-deposit` sớm nhất (`customer.tags[].time`) nằm trong kỳ — giống cách trang Follow up đang tính.
- Hội thoại booking lấy theo tin nhắn từ đầu kỳ tới hôm nay (không dừng ở cuối kỳ), vì khách gắn trong kỳ có thể nhắn tiếp sau kỳ.
- Không có thời điểm gắn tag → không tính.

## Impact

- `lib/smax-inbox.ts` (`buildInboxReport`), `lib/smax-inbox.test.ts`, `app/(app)/customers/smax-report/actions.ts`.
- Số thật: 17/11 12 → 3; 16/11 = 14; 10–17/11 = 87.
