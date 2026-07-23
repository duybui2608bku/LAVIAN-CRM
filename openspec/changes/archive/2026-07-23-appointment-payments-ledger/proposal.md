# Proposal: appointment-payments-ledger

## Why

Ba lỗ hổng vận hành ở `/appointments`:

1. **Bấm nhầm trạng thái không quay lại được** — check-in/hoàn tất nhầm phải sửa tay trong DB; "khách đến nhưng không làm dịch vụ" không có chỗ ghi nhận.
2. **Tiền chỉ là 2 con số tĩnh** (`deposit_amount`, `final_amount`) trên mỗi lịch hẹn — không có lịch sử từng lần thu (ngày thu, ai thu, phương thức), hoàn cọc phải "set về 0" làm mất dấu vết, không cộng được tổng tiền một khách đã trả qua các lần hẹn một cách tin cậy.
3. **Không đính kèm được ảnh chứng từ** (bill chuyển khoản, biên nhận) cho mỗi lần thanh toán.

## What Changes

- **Máy trạng thái có hoàn tác:** server action `setAppointmentStatus` chỉ chấp nhận transition trong whitelist; thêm transition ngược `checked_in → booked` (bấm nhầm "đã đến") và `completed → checked_in` (bấm nhầm "hoàn tất") — hoàn tác xóa timestamp mốc tương ứng; thêm `checked_in → cancelled` cho ca "đến nhưng không làm dịch vụ" (thống kê phân biệt với hủy thường bằng `checked_in_at is not null`). KHÔNG thêm status mới.
- **Sổ thanh toán `appointment_payments`** (bảng mới): mỗi dòng = một lần tiền vào/ra của một lịch hẹn — loại (`deposit|payment|refund`), số tiền, phương thức, **ảnh chứng từ**, ghi chú, ngày thu, người tạo. Hoàn cọc = thêm dòng `refund` (bảo toàn lịch sử), KHÔNG sửa/xóa số cũ.
- **BREAKING (schema):** bỏ cột `appointments.deposit_amount` — "Đã thu" tính từ sổ (`Σ deposit+payment − Σ refund`); migration backfill cọc hiện có thành dòng `deposit`, và lịch `completed` có `final_amount` thành dòng `payment` phần còn lại. `expected_amount` (báo giá) và `final_amount` (doanh số chốt của LẦN hẹn) giữ nguyên trên `appointments` — làm rõ: doanh số vốn đã theo từng lịch hẹn, tổng khách đã trả = Σ sổ thanh toán mọi lịch hẹn của khách.
- **UI:** dialog "Thanh toán" per lịch hẹn (danh sách dòng + thêm thu/hoàn + upload ảnh — tái dùng `ImageUpload` + bucket `images` sẵn có); cột "Cọc" trong bảng thành "Đã thu"; popover Hoàn tất nhập doanh số chốt + tiền thu lần này + ảnh; nút hoàn tác ở nhóm đã đến/hoàn tất; tổng đã trả của khách hiện ở dialog lịch sử lịch hẹn `/customers`.

## Capabilities

### New Capabilities
- `appointment-payments`: sổ thanh toán theo lịch hẹn — ghi/hoàn tiền có ảnh chứng từ, tính "Đã thu"/"Còn nợ", tổng đã trả theo khách.

### Modified Capabilities
- `appointments`: (1) transition trạng thái theo whitelist + hoàn tác + ca "đến không làm dịch vụ"; (2) mô hình tiền bỏ `deposit_amount` tĩnh, "Đã thu" lấy từ sổ thanh toán.

## Impact

- **DB:** migration mới `supabase/migrations/*_appointment_payments.sql` (bảng + RLS + backfill + drop `deposit_amount`). Bucket storage `images` dùng lại, không đổi.
- **Server actions:** `app/(app)/appointments/actions.ts` (transition whitelist, hoàn tác, CRUD dòng thanh toán, tạo lịch kèm cọc → insert dòng sổ).
- **Types/helpers:** `types/appointment.ts` (bỏ `deposit_amount`, thêm `AppointmentPayment`, `payments` trên `Appointment`), `lib/appointments.ts` (`paidTotal`, `outstanding` đổi nguồn) + test.
- **UI:** `components/appointments/{appointments-manager,appointment-dialog}.tsx`, dialog thanh toán mới, `components/customers/customers-manager.tsx` (tổng đã trả), page queries nested thêm `appointment_payments`.
- **i18n:** namespace `appointments` thêm key (3 locale).
