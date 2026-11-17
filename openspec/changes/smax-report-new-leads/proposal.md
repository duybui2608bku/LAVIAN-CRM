## Why

Sếp chỉ muốn Báo cáo Smax đo **hiệu suất khách mới**. Trước đây "Tổng hội thoại" đếm mọi hội thoại có tin nhắn trong kỳ (gồm khách cũ nhắn lại), nên số lệch xa số tin nhắn từ quảng cáo.

## What Changes

- **Hội thoại mới:** lấy hội thoại theo NGÀY TẠO (`sort_by_created_at: true`). Thẻ "Hội thoại mới" = số hội thoại này (kể cả chưa gắn trạng thái). Potential / Follow Up / Pending 24H / Spam đếm trên tập này.
- **Booking:** truy vấn riêng `sort_by_created_at: false` + `tags: ["bookings-deposit","booking"]`, `tags_condition: "OR"` (bắt buộc, thiếu → SMAX 400). Gồm cả khách cũ quay lại đặt lịch. "Booking khách cũ" = booking có hội thoại tạo trước kỳ.
- Tỉ lệ % và cột Tổng tính trên số hội thoại mới. Thanh phân bổ vẫn dùng tổng các trạng thái.
- Trang Follow up giữ nguyên (vẫn lấy theo tin nhắn mới nhất).

## Lưu ý kỹ thuật

- Khi `sort_by_created_at: true`, con trỏ `after` của SMAX vẫn so với `last_message_at` → từ trang 2 rớt khách mới đã nhắn tiếp (kiểm 01–16/11: thiếu 351/2.578). Phân trang bằng cách lùi mốc cuối `dateRange` về `created_at` của dòng cuối, bỏ trùng theo id.

## Impact

- `lib/smax-threads.ts`, `lib/smax-inbox.ts` (+ test), `app/(app)/customers/smax-report/actions.ts`, `components/customers/smax-report-view.tsx`, `messages/{vi,en}.json`
