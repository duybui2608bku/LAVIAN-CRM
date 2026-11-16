## Why

Sếp cần theo dõi việc Telesales "bào" (chăm sóc lại) data cũ mỗi ngày: bào được bao nhiêu hội thoại cũ, chuyển được bao nhiêu sang Booking / Show-up, và tổng booking trong ngày chia thành booking từ data mới và từ data cũ.

## What Changes

- **Trang "Follow up" `/customers/smax-followup`** (quyền `customers.view`, menu Khách hàng → Danh sách | Báo cáo Smax | Follow up). Bộ lọc giống Báo cáo Smax: khoảng ngày + Telesales (lọc phía client) + Tải lại.
- Dùng lại `fetchInboxThreads` (hội thoại WA + IG có tin nhắn trong khoảng ngày). Mỗi hội thoại SMAX có `created_at` (ngày khách nhắn lần đầu) và `customer.tags[].time` (thời điểm gắn từng tag).
- Định nghĩa (khoảng ngày theo giờ WIB):
  - **Data cũ** = hội thoại tạo trước ngày bắt đầu; **data mới** = tạo trong khoảng.
  - **Số bào** = hội thoại data cũ có tin nhắn trong khoảng.
  - **Booking follow-up** = data cũ được gắn tag Booking (`booking` / `bookings-deposit`, lấy lần gắn sớm nhất) trong khoảng.
  - **Show-up** = data cũ được gắn tag `purchase` (khách đến phòng khám và thanh toán) trong khoảng.
  - **Chất lượng bào** = số hội thoại data cũ chuyển sang Booking hoặc Show-up ÷ Số bào.
  - **Booking mới** = data mới được gắn Booking trong khoảng. **Tổng booking** = Booking mới + Booking follow-up.
  - Nhân viên theo tag tên (như Báo cáo Smax) + dòng "Chưa gán".
- 5 thẻ: Số bào, Chất lượng bào (số + %), Booking mới, Booking follow-up, Tổng booking. Bảng theo Telesales với các cột trên; bấm dòng = lọc.

## Giới hạn

- SMAX không lưu lịch sử đổi tag → không biết trạng thái trước khi chuyển là Follow-up, Pending hay Unanswer; mọi data cũ chuyển sang Booking/Show-up đều tính là bào thành công.
- "Số bào" là hội thoại cũ có tin nhắn trong khoảng — không phân biệt nhân viên chủ động nhắn hay khách tự quay lại.
- Hội thoại gắn Booking/Purchase trong khoảng nhưng không có tin nhắn nào trong khoảng sẽ không được lấy về.
- Tag gỡ ra rồi gắn lại thì thời điểm gắn là lần gắn sau cùng.
- Thời điểm gắn lấy từ `customer.tags`, có lúc lệch với `tag_aliases` của hội thoại (16/11: 21/319 hội thoại, phần lớn là no-reply/follow-up).
- Hội thoại gắn `purchase` thường chỉ còn đúng tag đó (không còn tag nhân viên) → Show-up rơi vào dòng "Chưa gán".
- Số thật 16/11 (đến ~15h WIB): 319 hội thoại, Số bào 150, chuyển đổi 14 (4 Booking + 10 Show-up), Booking mới 3.

## Impact

- `lib/smax-followup.ts` (logic thuần + test), `lib/smax-inbox.ts` (thêm trường vào kiểu `InboxThread`)
- `app/(app)/customers/smax-followup/page.tsx`, `app/(app)/customers/smax-report/actions.ts` (thêm `getFollowupReport`)
- `components/customers/smax-followup-view.tsx`, `components/layout/app-shell.tsx`, `messages/{vi,en}.json`
- Không đổi DB.
