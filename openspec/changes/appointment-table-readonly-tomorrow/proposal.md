## Why

Sales Management (`/appointments`): sếp không muốn sửa trực tiếp trên bảng ở cột Dịch vụ chi tiết và Tài chính (IDR) — dễ bấm nhầm khi lướt bảng. Thanh lọc mới có nút nhanh "Hôm nay", thiếu "Ngày mai" để chuẩn bị lịch hôm sau.

## What Changes

- Cột **Dịch vụ chi tiết**: chỉ xem (tag tên dịch vụ, chưa có → "—"), bỏ `InlineMultiSelect`.
- Cột **Tài chính (IDR)**: Giá trị DV chỉ xem (số định dạng IDR như Deposit), bỏ `BillInput`.
- Thanh lọc: thêm nút **Ngày mai** cạnh Hôm nay (lọc đúng 1 ngày = hôm nay + 1, giờ máy).

## Impact

- Sửa: `components/appointments/appointments-manager.tsx`, `messages/{vi,en}.json` (`appointments.tomorrow`).
- **Không** migration DB, **không** đổi API (`patchAppointment` vẫn nhận `service_ids` / `bill_amount`).
- Lưu ý: hiện chưa còn chỗ nào khác trên UI để sửa Dịch vụ chi tiết / Giá trị DV.
