## Why

Sếp: làm thông báo realtime cho Quản lý đặt lịch, Quản lý bán hàng, Tour, Thẻ liệu trình, Hành trình điều trị, Tài liệu.
Ràng buộc: **chỉ thông báo trên web** (chuông header, không push / email), **không spam, không trùng, đúng người**.

Hạ tầng đã có (2026-11-18): bảng `notifications` + RLS chỉ đọc của mình + publication `supabase_realtime`, chuông
`useNotifications` (1 kênh realtime), cron follow-up. Thiếu: sự kiện của 6 module, cơ chế chống trùng chung.

## What Changes

- **Hàm chung `notify_users()`** (security definer, không mở cho client): lọc user active, bỏ người thao tác,
  bỏ người đã nhận thông báo khác trong cùng thao tác, **thay thế** thông báo chưa đọc cùng `kind + ref`
  (sửa liên tục 1 lịch hẹn → chỉ còn 1 thông báo mới nhất). Cột mới `notifications.ref`.
- **Trigger DB** cho từng module (bắt mọi đường ghi: drawer, sửa inline, RPC, lead form):
  - Lịch hẹn: tạo hộ Telesales, giao Sales, khách đến cơ sở, đổi giờ, huỷ.
  - Tour: chờ nhận (gửi bộ phận Master, gộp theo khách), được giao, đổi ngày, huỷ; Master nhận → gỡ thông báo
    "chờ nhận" chưa đọc của Master khác.
  - Thẻ: bán thẻ (báo Telesales của khách), thu tiền hộ (báo Sales bán thẻ), hoàn tiền (admin + Sales bán), huỷ thẻ.
  - Tài liệu: tài liệu mới (bộ phận được xem), bình luận / trả lời (tác giả).
- **Hành trình điều trị**: 1 thông báo tổng hợp / Telesales / ngày ("N khách đến hạn · M quá hạn"), tạo lần đầu
  mở app trong ngày (tính bằng `journeyDue` có sẵn, không viết lại logic bằng SQL); unique index chặn trùng.
- **Client**: bảng ánh xạ `kind → icon + chữ`, toast khi có thông báo mới, gộp dòng cùng `ref` trong danh sách.

## Impact

- Migration `supabase/migrations/20261128100000_realtime_notifications.sql` (chạy SAU `20261118090000`).
- Sửa: `components/layout/notification-bell.tsx`, `messages/{vi,en}.json`.
- Thêm: `lib/notifications.ts` (+test), server action `ensureJourneyDigest` (`app/(app)/customers/journey/actions.ts`).
- Không thêm dependency, không push / email, không đổi luồng nghiệp vụ.
