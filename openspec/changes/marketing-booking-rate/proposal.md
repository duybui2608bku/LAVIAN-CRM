## Why
Trang Marketing chỉ thấy số Đặt lịch, không biết bao nhiêu % người nhắn tin đã đặt lịch. Các ô số liệu bằng 0 hiện "0" / "0 ₫" làm bảng rối, khó nhìn ra chỗ có số. Bảng chiến dịch rộng: cột Tài khoản quảng cáo chiếm chỗ riêng, cột Trạng thái thừa khoảng trống.

## What Changes
- Thẻ **Đặt lịch** hiện thêm tỉ lệ so với **Tin nhắn**: `1 · 3%` (Đặt lịch ÷ Tin nhắn, tối đa 1 chữ số thập phân).
- Bảng chiến dịch có **cột riêng "Tỉ lệ đặt lịch"** (Đặt lịch ÷ Tin nhắn) ngay sau cột Đặt lịch; dòng con WA/IG không có tin nhắn riêng → để trống.
- Bỏ cột **Tài khoản quảng cáo**: tên tài khoản hiện chữ nhỏ, màu phụ dưới tên chiến dịch; bộ lọc theo tài khoản chuyển sang cột Tên chiến dịch.
- Cột **Trạng thái** thu hẹp vừa nút bật/tắt.
- Mọi số liệu bằng 0 (tiền, đếm, chi phí trung bình, phễu, lượt hiển thị/tiếp cận, tin nhắn theo số WA) hiện `—`, giống ô thiếu dữ liệu.

## Impact
- `components/marketing/ads-stats.tsx`, `messages/{vi,en}.json` (+`bookingRate`, −`colAccount`). Không đổi DB.
