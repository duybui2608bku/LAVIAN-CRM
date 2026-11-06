## Why

Tour của kỹ thuật viên đang tính trên Lịch hẹn, khiến Lịch hẹn vừa là sổ lịch hẹn vừa là sổ làm dịch vụ. Lịch hẹn chỉ nên trả lời "khách có đến không" (để tính doanh số CSKH). Việc làm dịch vụ + tiền tour cần quy trình riêng: CSKH tạo → KTV nhận → KTV điền chi tiết + ảnh → admin xác nhận.

## What Changes

- **BREAKING** `/appointments`: bỏ Thanh toán, Kỹ thuật viên, Dịch vụ chi tiết, Bill, Tour (cột bảng, drawer tạo, schema, action). Bỏ logic tính tour trên lịch hẹn.
- Bảng mới `public.tours`: ngày, khách, dịch vụ, dịch vụ chi tiết, lần (cột riêng), ghi chú, KTV, ảnh trước / ảnh sau / ảnh thêm, bill, phương thức thanh toán, xác nhận (admin).
- Thực thu = round(bill × %) tính trong code: Laser n 0%, Plasma n 0%, New 7%, Debt 7%, Retouch 1 3%, Retouch ≥2 0%.
- Menu **Tour** (`/tour`):
  - CSKH/admin: tạo tour (ngày, khách, dịch vụ, ghi chú), bảng tour theo tháng, lọc trạng thái/KTV; admin xác nhận/bỏ xác nhận, gán lại KTV, giữ Xuất Excel + Phiếu tour PDF.
  - KTV (giao diện điện thoại): tab **Chờ nhận** (nút "Nhận tour") và **Tour của tôi** theo tháng (trạng thái đã/chưa xác nhận, tổng tour + thực thu tháng). Bấm tour → drawer điền dịch vụ chi tiết, lần, bill, thanh toán, chụp ảnh (bấm là mở camera, tải lên và lưu ngay).
- Tour đã xác nhận bị khoá với người không phải admin (trigger DB).

## Capabilities

### New Capabilities
- `tour-workflow`: quy trình tour CSKH → KTV → admin.

### Modified Capabilities
- `technician-tour-page`: thay bằng `tour-workflow` (dữ liệu lấy từ `tours`, không còn từ lịch hẹn).

## Impact

- Migration `20261106120000_tours.sql` (tạo bảng + chép dữ liệu tour cũ) và `20261106120100_drop_appointment_tour_columns.sql` (xoá 5 cột cũ — chạy SAU khi deploy code mới).
- Sửa `app/(app)/appointments/*`, `components/appointments/appointments-manager.tsx`, `lib/appointments.ts(+test)`, `types/appointment.ts`, `app/(app)/services/actions.ts`.
- Viết lại `app/(app)/tour/*`, `components/tour/*`; thêm `lib/tours.ts(+test)`, `types/tour.ts`; i18n vi/en.
