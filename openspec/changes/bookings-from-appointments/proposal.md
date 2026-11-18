# Proposal: bookings-from-appointments

## Why
Trang Booking management (`/customers/bookings`) đang liệt kê **khách** theo stage Booking/Deposited. Telesales cần quản lý theo **lịch hẹn** (giờ đến, trạng thái xác nhận, đã đến) như mockup.

## What Changes
- `/customers/bookings` lấy dữ liệu từ `clinic_appointments` (lịch chưa xoá, khách chưa xoá), không lọc theo stage khách nữa.
- 4 card: Lịch hôm nay, Chưa xác nhận (hôm nay), Cần xử lý, Đã đến (hôm nay).
- Tab Hôm nay / Ngày mai / Cần xử lý / Tất cả; tìm tên, SĐT, dịch vụ; lọc trạng thái, Tele; nút Tạo lịch hẹn.
- Cột: Lịch hẹn (giờ + ngày), Khách hàng / Dịch vụ, Deposit, Tele, Nguồn, Trạng thái, Ghi chú. **Không** có cột Nhắc lịch.

## Impact
- Không đổi DB (RLS `clinic_appointments` đã cho user active).
- File: `app/(app)/customers/bookings/page.tsx`, `components/appointments/bookings-manager.tsx` (mới), export helper từ `appointments-manager.tsx`, prop `format` cho `AppointmentDate`, i18n vi/en.
