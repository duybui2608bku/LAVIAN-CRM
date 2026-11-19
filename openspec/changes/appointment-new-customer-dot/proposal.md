# Proposal: appointment-new-customer-dot

## Why

Mẫu "Sales Management" của sếp có chấm tròn xanh cạnh tên khách = khách mới, khách cũ thì không có chấm. Trong mẫu, khách duy nhất không có chấm (Dewi Anggraini) đang làm dịch vụ Retouch, tức là khách quay lại. Vì vậy "khách mới" được hiểu là **khách đến lần đầu**.

## What Changes

- **Định nghĩa:** một lịch hẹn là của khách mới khi khách **chưa có lịch nào đã đến** (Status Đã đến / Đang thực hiện / Đã thực hiện) xếp **sớm hơn** lịch này.
  - Lần đầu khách đến vẫn hiện chấm, kể cả sau khi đã đến hoặc đã làm xong.
  - Những lịch sau lần đến đầu tiên (Retouch, làm tiếp…) là khách cũ, không có chấm.
  - Lịch không đến (Chưa đến / Đổi lịch) không làm khách thành khách cũ.
- **`/appointments` (Sales Management):** chấm xanh nhỏ ngay sau tên khách, hover hiện "Khách mới (chưa từng đến trước lịch này)".
- Tính ở client từ danh sách lịch đã tải, không đổi DB. Hàm `newCustomerAppointmentIds` trong `lib/appointments.ts`. Muốn đổi định nghĩa thì chỉ sửa hàm này.

## Impact

- `lib/appointments.ts` (+test), `components/appointments/appointments-manager.tsx`, `messages/{vi,en}.json`
- Giới hạn: lượt đến trước khi dùng CRM không có trong hệ thống. Khách cũ từ trước đó vẫn hiện là khách mới ở lịch đầu tiên được ghi trong CRM.
