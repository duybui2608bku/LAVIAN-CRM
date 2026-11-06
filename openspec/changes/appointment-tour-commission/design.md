## Context

`clinic_appointments` là bảng lịch hẹn đơn giản (sửa inline từng ô). Mỗi lịch có kỹ thuật viên (`technician_id`). Tour của KTV phụ thuộc loại dịch vụ chi tiết và số lần, nhân với bill của lịch đó.

## Goals / Non-Goals

**Goals:** chọn dịch vụ chi tiết bằng 1 lần bấm; nhập bill inline; thấy ngay tour.

**Non-Goals:** báo cáo tổng tour theo KTV/tháng; lưu lịch sử tỷ lệ; audit tiền cho bill (khác `money-audit`, vốn dành cho sổ liệu trình/thanh toán).

## Decisions

- **Hai cột DB thay vì một chuỗi gộp:** `service_detail text` (enum qua check) + `service_session smallint` (1–10). Check constraint đảm bảo: New/Debt thì `service_session` null, Laser/Plasma/Retouch thì bắt buộc 1–10. Dễ lọc/thống kê sau này.
- **UI một select gộp:** giá trị mã hóa `"<loại>:<lần>"` (vd. `retouch:2`) hoặc `"new"`; nhóm theo loại, có tìm kiếm, nhãn kèm %. Một lần bấm thay vì chọn loại rồi chọn số lần.
- **Tỷ lệ trong code** (`tourRate(detail, session)` trong `lib/appointments.ts`), tour = `round(bill × rate)`, không lưu DB. Đơn giản, test được; chấp nhận việc đổi tỷ lệ sẽ áp ngược cho lịch cũ.
- **Bill:** `bigint`, ≥ 0, nullable (chưa nhập). Hiển thị bằng `formatRupiah`.

## Risks / Trade-offs

- Đổi tỷ lệ áp ngược lịch cũ → nếu cần chốt cứng, sau này thêm cột snapshot `tour_rate`.
- Ai đang hoạt động cũng sửa được bill (giống các ô khác của bảng này) → đúng mô hình CRM nội bộ hiện tại.
