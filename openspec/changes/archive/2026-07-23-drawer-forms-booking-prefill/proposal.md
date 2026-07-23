# Proposal: Form drawer bên phải + prefill thông tin khách khi đặt lịch

## Why

Hai form nhập liệu dài nhất hệ thống (Thêm/Sửa khách hàng, Đặt lịch hẹn) đang là Dialog giữa màn hình — với form nhiều trường phải cuộn trong khung `max-h-[90vh]`, che khuất bảng dữ liệu phía sau. Drawer trượt từ cạnh phải cho chiều cao đầy màn hình, nhìn được bảng bên cạnh, là pattern chuẩn cho form dài trong CRM. Đồng thời khi đặt lịch cho khách, nhân viên phải nhập lại Nguồn/Dịch vụ/Nhân viên phụ trách dù khách đã có sẵn các thông tin này — thừa thao tác và dễ lệch dữ liệu.

## What Changes

- `CustomerDialog` (trong `customers-manager.tsx`) chuyển từ `Dialog` → `Sheet` (drawer phải, full-height, form cuộn trong thân, footer dính đáy). Giữ nguyên toàn bộ field + logic RHF/zod/submit.
- `AppointmentDialog` chuyển tương tự sang `Sheet`.
- Đặt lịch hẹn tự điền thông tin ban đầu của khách (chỉ khi TẠO MỚI, không áp dụng khi sửa):
  - Khách khóa cứng (`customerLock` từ /customers): giá trị khởi tạo form lấy `source`, `service_ids`, `staff_id` của khách.
  - Chọn khách trong select (/appointments): đổi khách → set lại 3 trường trên theo khách vừa chọn.
- Mở rộng `CustomerRef` thêm `source`, `staff_id`, `service_ids` (optional); query customers ở `/appointments/page.tsx` select thêm các cột này + nested `customer_services(service_id)`.
- KHÔNG làm lại multi-select dịch vụ cho khách hàng — đã có sẵn (MultiSelect ở dialog + inline bảng).
- KHÔNG thay đổi DB — không migration.

## Capabilities

### New Capabilities

(không có)

### Modified Capabilities

- `customer-management`: form tạo/sửa khách hàng hiển thị dạng drawer bên phải thay vì dialog giữa màn hình.
- `appointments`: form đặt lịch hiển thị dạng drawer bên phải; khi tạo mới, form tự điền Nguồn/Dịch vụ/Nhân viên từ hồ sơ khách được chọn.

## Impact

- `components/customers/customers-manager.tsx` — CustomerDialog → Sheet.
- `components/appointments/appointment-dialog.tsx` — Dialog → Sheet + prefill (mở rộng props type `CustomerRef`).
- `app/(app)/appointments/page.tsx` — query customers thêm `source, staff_id, customer_services(service_id)` → map `service_ids`.
- Không đổi: actions, types DB, migrations, i18n key hiện có (tái dùng title/nút sẵn có).
