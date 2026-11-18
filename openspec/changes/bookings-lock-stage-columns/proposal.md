# Proposal: bookings-lock-stage-columns

## Why

Trang Booking management (`/customers/bookings`) dùng để theo dõi lịch hẹn của khách Booking/Deposited — không phải nơi đổi stage. Cột Lịch hẹn là thông tin chính nên cần đứng đầu.

## What Changes

- `/customers/bookings`: **không đổi được Stage** — ô Stage trên bảng chỉ xem; drawer sửa khách khoá ô Stage (gửi lại stage hiện tại). Tạo khách mới vẫn chọn stage như cũ.
- `/customers/bookings`: cột **Lịch hẹn lên đầu**, cột **Ngày tạo xuống cuối**; các cột khác giữ thứ tự.
- `/customers` không đổi. Không đổi DB.

## Capabilities

### Modified Capabilities
- `customers`: trang Booking management khoá stage + đổi thứ tự cột.

## Impact

- `components/customers/customers-manager.tsx`
