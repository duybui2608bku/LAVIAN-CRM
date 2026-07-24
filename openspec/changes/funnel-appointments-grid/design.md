## Context

2 API thống kê đã có sẵn (`/api/customers/funnel` — admin, 4 chỉ số phễu + growth; `/api/appointments/summary` — login, selected/newCustomer/tomorrow + growth + period metadata). Dashboard hiện render 2 section này từ `getMarketingStats` (gọi 2 lần để tự tính growth) kèm pie chart và card "Tổng lịch hẹn". Ảnh mẫu: pipeline có mũi tên + % chuyển đổi, card lịch hẹn có Deposit/No deposit.

## Goals / Non-Goals

**Goals:**
- 2 section trên `/` đọc từ 2 API, đúng bố cục ảnh, bỏ WhatsApp + Tổng lịch hẹn.
- API summary trả thêm deposit breakdown để card lịch hẹn đủ số như ảnh.

**Non-Goals:**
- KHÔNG gỡ phần trùng trong `getMarketingStats` (spend/staff/reply-time vẫn dùng; dọn sau).
- KHÔNG thêm deposit vào card Booking của phễu (chi tiết cọc đã nằm ở section lịch hẹn).
- KHÔNG đổi funnel API.

## Decisions

1. **Deposit breakdown đếm bằng head-count embed**: `select("id, appointment_payments!inner(id)", { count: "exact", head: true }).eq("appointment_payments.kind", "deposit")` — khác action (kéo row rồi filter) để tránh trần 1.000 row; `notDeposited = count − deposited`. Chỉ kỳ hiện tại (ảnh không có deposit kỳ trước) → Promise.all 6 → 9 query.
2. **% trên card phễu = tỉ lệ so bước đầu** (`count / messages.count`): khớp 3/4 số trong ảnh (68.2%, 20.4%, tổng 15.8%); card Khách nhắn tin = 100%. `messages` null/0 → ẩn %.
3. **Label linh hoạt tính từ `period` của API** (không tin client): `from===to===today` → "Lịch hẹn hôm nay"; `from===to` → "Lịch hẹn dd/MM"; khoảng → "Lịch hẹn dd/MM – dd/MM". Badge growth card ngày mai dùng nhãn "so với hôm nay" (previousCount của tomorrow là hôm nay).
4. **Pipeline layout**: flex cột (mobile) → hàng (xl) với `ChevronRight` giữa các card; card tái dùng `MetricCard` thêm prop `share` hiển thị % cạnh count.
5. **Fetch**: 2 API fetch trong cùng `startTransition` với `getMarketingStats`; lần gọi `getMarketingStats` kỳ trước chỉ còn khi `showSpend` (growth spend là chỗ duy nhất còn dùng). Pie chart + card Tổng lịch hẹn xóa hẳn (khôi phục từ git nếu cần).
6. **Delta spec**: capability `appointment-stats-api` nhận requirement MỚI về deposit breakdown (change gốc chưa archive nên không MODIFY được text cũ).

## Risks / Trade-offs

- [2 nguồn số song song (action + API) trong 1 component] → định nghĩa query giống hệt nên số khớp; dọn `getMarketingStats` là bước sau.
- [Thêm 3 query vào summary API] → head-count nhẹ, chạy song song trong Promise.all sẵn có.
- [Xóa pie chart là bớt tính năng] → chủ đích theo ảnh mẫu; ghi rõ trong summary cho user.
