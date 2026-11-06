## Why

Kỹ thuật viên cần tự xem tiền tour mình được hưởng theo tháng, không phải hỏi quản lý hay dò bảng Lịch hẹn.

## What Changes

- Trang mới `/tour` trong menu chính, mọi user đăng nhập đều vào được.
- Mặc định hiển thị lịch hẹn của **chính user** (`technician_id = user`), chỉ tính lịch **khách đã đến** (`checked_in = true`).
- Chọn tháng (mặc định tháng hiện tại). Thẻ tổng: Tổng tour, Tổng bill, Số lịch.
- Bảng: Ngày, Khách, Dịch vụ chi tiết, Bill, %, Tour. Lịch thiếu bill/dịch vụ chi tiết vẫn hiện, tour để "—", để KTV biết mà báo bổ sung.
- Admin có thêm select chọn kỹ thuật viên để xem tour của người khác.
- Chỉ xem, không sửa ở trang này.

## Capabilities

### New Capabilities

- `technician-tour-page`: Trang xem tiền tour theo tháng của kỹ thuật viên.

### Modified Capabilities

Không có.

## Impact

- Không đổi DB. Dùng lại `tourAmount`/`tourRate` từ `lib/appointments.ts` (change `appointment-tour-commission`).
- Thêm `app/(app)/tour/page.tsx`, `components/tour/tour-view.tsx`, mục menu trong `app-shell.tsx`, i18n vi/en.
- RLS hiện tại cho mọi nhân viên active đọc `clinic_appointments`; việc giới hạn "chỉ xem của mình" là ở tầng trang (non-admin bị ép về chính mình).
