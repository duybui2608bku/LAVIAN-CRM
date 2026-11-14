## Why

Form SMAX (`/lead-form`) bị cuộn dọc trên màn hình thấp (người dùng phản hồi); cảnh báo "khách đã tồn tại" chiếm cả một khối; ô Đánh giá không cần ở form này.

## What Changes

- Bỏ ô Rating khỏi form + server action (cập nhật không đè rating trong CRM).
- Cảnh báo khách đã tồn tại → icon chấm than cạnh nhãn Full name, hover/chạm hiện đủ câu.
- Sắp xếp gọn: Full name | Phone, Telesales | Stage, Deposit | Payment confirm (khung ảnh thấp), Note 2 dòng, bỏ thanh nút sticky.
- Trang cao đúng 1 màn hình (`h-svh`, không cuộn); `FitToHeight` thu nhỏ (scale ≥ 0.7) tab Khách hàng cho vừa chiều cao; tab Lịch hẹn: lịch sử cuộn trong khung riêng.

## Impact

- `app/lead-form/{page,actions}.ts(x)`, `components/lead-form/{lead-form,lead-appointment-form}.tsx`, `messages/{vi,en}.json` (bỏ `leadForm.rating`). Không đổi DB.
