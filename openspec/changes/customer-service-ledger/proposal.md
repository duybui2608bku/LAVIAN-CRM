# Proposal: customer-service-ledger

## Why

Một liệu trình dịch vụ thường kéo dài nhiều buổi hẹn, nhưng tiền hiện gắn cứng vào TỪNG lịch hẹn (`expected_amount`/`final_amount` per appointment + sổ `appointment_payments` per appointment). Hệ quả:

1. Khách A mua dịch vụ B giá 500.000 đ, hẹn ngày 1/1 trả 200.000 đ — đặt tiếp buổi 5/1 cùng dịch vụ thì lịch mới không thấy giá và số đã trả; nhân viên phải chép tay 2 nơi, sửa một bên là lệch (đúng nỗi lo "sửa ngày 1/1 mà không sửa ngày 5/1").
2. Dịch vụ không bắt buộc khi đặt lịch → có lịch hẹn không biết làm gì, và không có khóa (khách, dịch vụ) để tra cứu tiền.
3. Không nhận diện nhanh khách cũ (đã từng có lịch hẹn) khi đặt lịch mới.

## What Changes

- **Sổ tiền dùng chung `service_ledgers`** (bảng mới): mỗi cặp (khách hàng, dịch vụ) có tối đa **1 sổ đang mở** — giữ `total_amount` (tổng giá liệu trình) và gom mọi dòng `appointment_payments` của liệu trình. Lịch hẹn trỏ về sổ qua FK `appointments.ledger_id` (lookup 2 chiều: sửa tổng giá/thêm tiền ở lịch nào cũng là sửa cùng 1 sổ). Đặt lịch mới cùng khách + cùng dịch vụ → tự nối vào sổ đang mở; khác dịch vụ → sổ mới.
- **Nút Đóng sổ (tất toán) thủ công:** sổ đóng (`closed_at`) thì khóa thêm dòng tiền; lịch mới cùng dịch vụ sau đó mở sổ MỚI từ đầu. Có nút mở lại nếu bấm nhầm.
- **BREAKING (schema):** bỏ cột `appointments.expected_amount` + `final_amount` — tổng giá chỉ còn 1 con số `service_ledgers.total_amount`; `appointment_payments` thêm `ledger_id` (dòng tiền thuộc sổ, `appointment_id` giữ lại làm dấu vết buổi thu). Migration backfill: gom lịch hẹn hiện có theo (khách, dịch vụ đầu tiên) thành sổ, tổng giá lấy `coalesce(final, expected)` của lịch mới nhất trong nhóm, nối lại các dòng tiền cũ.
- **Dịch vụ bắt buộc, 1 dịch vụ / lịch hẹn:** form đặt lịch đổi multi-select → select đơn bắt buộc (client + server validate); bảng nối `appointment_services` giữ nguyên schema (lịch cũ nhiều dịch vụ vẫn hiển thị, sửa thì phải chọn lại 1).
- **Tag "Khách cũ":** khách đã có lịch hẹn khác trước đó → badge "Khách cũ" ở bảng `/appointments` và trong drawer đặt lịch khi chọn khách (suy ra từ dữ liệu, không thêm cột).
- **Bỏ dòng tổng doanh thu ngày** ở bảng `/appointments` (`dayTotal`) — thống kê doanh thu làm sau ở menu riêng.

## Capabilities

### New Capabilities

(không có — sổ tiền là sự tiến hóa của capability `appointment-payments`)

### Modified Capabilities

- `appointment-payments`: sổ thanh toán dời từ per-lịch-hẹn sang per-(khách, dịch vụ) — tổng giá nằm trên sổ, dòng tiền gắn sổ, đóng/mở sổ thủ công, Đã thu/Còn nợ tính theo sổ. (Spec gốc đang nằm trong change `appointment-payments-ledger` chưa archive.)
- `appointments`: dịch vụ bắt buộc đúng 1 khi tạo/sửa; bỏ cột tiền per lịch (tiền tra qua sổ); tag "Khách cũ"; bỏ dòng tổng doanh thu ngày.

## Impact

- **DB:** migration mới `supabase/migrations/*_service_ledgers.sql` (bảng + RLS + unique partial index "1 sổ mở/cặp" + backfill + **drop 2 cột tiền** của appointments). Chạy SAU `20260715150000_appointment_payments.sql`.
- **Server actions:** `app/(app)/appointments/actions.ts` — resolve/tạo sổ khi tạo-sửa lịch, validate đúng 1 dịch vụ, sửa tổng giá = sửa sổ, addPayment ghi kèm `ledger_id`, action đóng/mở sổ.
- **Types/helpers:** `types/appointment.ts` (`ServiceLedger`, bỏ 2 field tiền), `lib/appointments.ts` (`paidTotal`/`outstanding` theo sổ, bỏ `dayTotal`) + test.
- **UI:** `components/appointments/{appointment-dialog,appointments-manager,payments-dialog}.tsx`, `components/customers/customers-manager.tsx` (lịch sử + tổng đã trả theo sổ), page queries nested `service_ledgers` ở 2 trang.
- **i18n:** namespace `appointments` thêm/bớt key × 3 locale.
