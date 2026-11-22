## Why
Trang Marketing chỉ thấy số Đặt lịch, không biết bao nhiêu % người nhắn tin đã đặt lịch. Các ô số liệu bằng 0 hiện "0" / "0 ₫" làm bảng rối, khó nhìn ra chỗ có số.

## What Changes
- Thẻ **Đặt lịch** và cột **Đặt lịch** (dòng chiến dịch) hiện thêm tỉ lệ so với **Tin nhắn**: `1 · 3%` (Đặt lịch ÷ Tin nhắn, tối đa 1 chữ số thập phân). Dòng con WA/IG không có tin nhắn riêng → chỉ hiện số.
- Mọi số liệu bằng 0 (tiền, đếm, chi phí trung bình, phễu, lượt hiển thị/tiếp cận, tin nhắn theo số WA) hiện `—`, giống ô thiếu dữ liệu.

## Impact
- `components/marketing/ads-stats.tsx`. Không đổi DB, không đổi i18n.
