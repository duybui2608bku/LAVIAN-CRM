## Why

Dữ liệu tiền hiện sửa được **không dấu vết**: mọi user đăng nhập xóa được dòng `appointment_payments` (RLS grant delete) và đổi được `service_ledgers.total_amount` (= doanh số) tùy ý — không log ai, lúc nào, giá trị cũ là gì. Trạng thái lịch hẹn đã có audit trigger (`appointment_status_history`), còn tiền — dữ liệu nhạy cảm hơn — thì chưa. Khi số liệu thực thu/doanh số lệch, không truy vết được.

## What Changes

- Thêm bảng `money_audit` (append-only) ghi lại 2 loại sự kiện:
  1. **Xóa dòng tiền** `appointment_payments` — snapshot toàn bộ dòng bị xóa (jsonb), ai xóa, lúc nào.
  2. **Sửa sổ** `service_ledgers` khi `total_amount` hoặc `closed_at` đổi — giá trị cũ → mới, ai, lúc nào.
- 2 trigger `security definer` tự ghi (app không thể quên), copy pattern `log_appointment_status` sẵn có.
- Audit chỉ ghi nhận **từ lúc chạy migration trở đi** — thay đổi trước đó không khôi phục được.
- KHÔNG có UI — truy vết qua Supabase SQL Editor khi cần. KHÔNG đổi code app, KHÔNG đổi hành vi ghi tiền hiện tại.

## Capabilities

### New Capabilities
- `money-audit`: audit trail bất biến cho thao tác phá hủy/sửa đổi dữ liệu tiền (xóa dòng thanh toán, đổi tổng giá / trạng thái tất toán của sổ liệu trình).

### Modified Capabilities

(không có — hành vi các capability hiện tại giữ nguyên, chỉ thêm ghi vết ở tầng DB)

## Impact

- **DB:** migration mới `supabase/migrations/20260723HHMMSS_money_audit.sql` — bảng `money_audit` + 2 trigger trên `appointment_payments` (after delete) và `service_ledgers` (after update). Idempotent, có ROLLBACK.
- **Code app:** không đổi (trigger tự chạy trong DB).
- **Vận hành:** phải chạy migration tay trong Supabase SQL Editor (sau `20260723090000`).
