# Proposal: potential-customers-page

## Why

Khách stage **Potential** (chưa Booking) cần được Telesales chăm lại đúng hẹn. Hiện chưa có chỗ theo dõi riêng: không ghi được "tình trạng" khách, không có ngày giờ liên hệ lại, không có thông báo khi tới hẹn.

## What Changes

- **Stage mới `consider` (Consider / Cân nhắc)** trong ô Status khách.
- **Trang mới `/customers/potential`** (menu con Khách hàng "Khách tiềm năng"), chỉ khách `stage = potential`:
  - 4 card: Tổng khách tiềm năng · Quá hạn liên hệ · Cần liên hệ hôm nay · Chuyển đổi booking hôm nay.
  - Lọc: tìm (tên/SĐT/ghi chú), Telesales, Tình trạng; tab Tất cả / Quá hạn / Hôm nay / Sắp tới (theo ngày giờ liên hệ lại).
  - Bảng: **Khách hàng** (3 dòng: tên · SĐT · ghi chú gần nhất + icon mở modal ghi chú), **Ngày tạo**, **Nguồn** (icon + số WA / IG như trang Khách hàng), **Tele** (sửa nhanh), **Tình trạng** (Quan tâm / Cân nhắc / Chưa phản hồi / Chuyển đổi đặt lịch + "N lần follow-up" = số ghi chú), **Ngày giờ liên hệ lại** (sửa nhanh + tag Quá hạn / Hôm nay / Sắp tới).
  - Chọn **Chuyển đổi đặt lịch** → mở drawer tạo lịch hẹn; tạo xong → khách sang stage Booking, ghi `converted_at`, rời trang.
- **Thông báo** (dùng lại bảng `notifications` + chuông header) cho **Telesales phụ trách khách**:
  - Đúng giờ liên hệ lại (cron mỗi 5 phút, trễ tối đa ~5 phút).
  - Tổng hợp 8:00 sáng: "Hôm nay N khách cần liên hệ · M quá hạn".
- Chuông header **bật lại** (tách khỏi cờ `REMINDERS_ENABLED`); menu/cột/trang nhắc hẹn vẫn tắt.

## Capabilities

### New Capabilities
- `potential-customers`: trang khách tiềm năng, tình trạng, ngày liên hệ lại, thông báo follow-up.

## Impact

- `supabase/migrations/20261118130000_potential_customers.sql`
- `app/(app)/customers/potential/page.tsx`, `app/(app)/customers/actions.ts`, `app/(app)/customers/customers-view.tsx`
- `components/customers/potential-manager.tsx` (mới), `components/customers/customers-manager.tsx` (export modal ghi chú + ô Nguồn)
- `components/layout/{app-shell,notification-bell}.tsx`, `lib/customer-options.ts`, `types/customer.ts`, `messages/{vi,en}.json`

## Non-goals

- Không tạo bảng ghi chú mới — dùng lại `customers.notes` (đã lưu người ghi + thời gian).
- Không che SĐT (giữ hiển thị đầy đủ như mọi bảng khác).
- Không push/email.
