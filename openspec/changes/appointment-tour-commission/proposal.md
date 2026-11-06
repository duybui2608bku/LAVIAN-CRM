## Why

Kỹ thuật viên được trả tiền tour theo từng lịch hẹn, tùy loại dịch vụ khách làm hôm đó. Bảng lịch hẹn (`clinic_appointments`) hiện chưa ghi loại dịch vụ chi tiết hay số tiền bill, nên không tính được tour.

## What Changes

- Thêm **Dịch vụ chi tiết** cho mỗi lịch hẹn: một trong Laser, Plasma, New, Debt, Retouch. Laser/Plasma/Retouch có thêm **số lần** (1–10); New/Debt không có số lần.
- Thêm **Bill** (số tiền Rupiah, số nguyên ≥ 0) cho mỗi lịch hẹn.
- Hiển thị **Tour** = Bill × tỷ lệ, chỉ đọc, tính từ quy tắc:
  - Laser (mọi lần) 0%, Plasma (mọi lần) 0%
  - New 7%, Debt 7%
  - Retouch lần 1 3%, Retouch lần ≥ 2 0%
- UI: một select duy nhất, nhóm theo loại, có tìm kiếm (vd. gõ "ret 2"), mỗi lựa chọn ghi kèm % tour. Bill sửa inline ngay trên bảng. Cả hai cũng có trong drawer tạo lịch hẹn.
- Bỏ ràng buộc "lịch hẹn không có trường tiền" trong test schema: giờ `bill_amount` được phép, các trường tiền khác vẫn bị chặn.

## Capabilities

### New Capabilities

- `appointment-tour`: Dịch vụ chi tiết + bill trên lịch hẹn, và cách tính tour cho kỹ thuật viên.

### Modified Capabilities

Không có.

## Impact

- Supabase: thêm cột `service_detail`, `service_session`, `bill_amount` vào `clinic_appointments` (migration). RLS/grant của bảng giữ nguyên.
- Code: `lib/appointments.ts` (schema + hàm `tourRate`), `types/appointment.ts`, trang/action `/appointments`, `appointments-manager.tsx`, `InlineSelect` (thêm option nhóm + tìm kiếm), i18n vi/en.
- Tỷ lệ % nằm trong code, không lưu DB: nếu sau này đổi tỷ lệ thì tour của lịch cũ cũng tính lại theo tỷ lệ mới.
