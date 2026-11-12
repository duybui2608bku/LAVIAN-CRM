## Why

Nhân viên trong SMAX đang mở Form SMAX (`/lead-form`) cho đúng 1 khách, nhưng muốn đặt lịch hẹn phải
sang CRM `/appointments` và tìm lại khách. Form đã biết khách (theo `smax_customer_id`) nên tạo lịch hẹn
ngay trong form là đủ, không cần ô tìm khách.

## What Changes

- Form SMAX chia 2 tab bằng antd `Segmented` (block):
  1. **Customer info** (mặc định) — nội dung form hiện tại, giữ nguyên.
  2. **Appointment** — tạo lịch hẹn cho khách đang mở. **Disable** khi khách chưa có trong CRM
     (hoặc đang kiểm tra); đổi sang khách chưa có → tự quay về tab 1.
- Tab Appointment gồm: Ngày & giờ (bắt buộc), Dịch vụ (nhiều), CSKH (mặc định CSKH đang phụ trách khách), Ghi chú.
  **Không có** ô chọn khách, **không hiện** Clinic confirmation — luôn lưu `checked_in = false` (chưa đến).
- Server Action public mới `createLeadAppointment(smaxCustomerId, input)` (admin client, vì trang anonymous):
  tìm khách theo `smax_customer_id`, kiểm CSKH (active + customer_care) và dịch vụ, insert `clinic_appointments`,
  `revalidatePath("/appointments")`. Trùng giờ (unique `customer_id, scheduled_at`) → báo lỗi `appointments.duplicate`.
- Trang `/lead-form` tải thêm danh sách dịch vụ đang bật.

Không đổi DB (bảng `clinic_appointments` đủ cột).

## Impact

- Code: `app/lead-form/{page,actions}.ts(x)`, `components/lead-form/lead-form.tsx`,
  `components/lead-form/lead-appointment-form.tsx` (mới), `messages/{en,vi}.json`.
- Bảo mật: action public cho phép tạo lịch hẹn với ai biết `smax_customer_id` — cùng mức với nút Update hiện có
  (id SMAX khó đoán). Chỉ insert, không đọc/sửa lịch khác.
