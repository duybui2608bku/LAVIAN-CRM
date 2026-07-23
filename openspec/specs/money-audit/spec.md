# money-audit Specification

## Purpose

Audit trail bất biến cho thao tác phá hủy/sửa đổi dữ liệu tiền: xóa dòng thanh toán (`appointment_payments`), đổi tổng giá / trạng thái tất toán của sổ liệu trình (`service_ledgers`). Ghi ở tầng DB bằng trigger — app không thể quên, SQL chạy tay cũng để vết.

## Requirements

### Requirement: Ghi vết xóa dòng tiền
Hệ thống SHALL tự động ghi một dòng audit (bảng `money_audit`, action `payment_deleted`) mỗi khi một dòng `appointment_payments` bị xóa — bất kể xóa qua app, qua SQL, hay do cascade — gồm snapshot jsonb toàn bộ dòng bị xóa, người thực hiện (`auth.uid()`, null nếu không có phiên) và thời điểm.

#### Scenario: Nhân viên xóa dòng thu trong dialog Thanh toán
- **WHEN** user xóa một dòng tiền qua `deletePayment`
- **THEN** `money_audit` có thêm 1 dòng `payment_deleted` với `old_data` chứa đủ kind/amount/paid_at/ledger_id của dòng vừa xóa, `changed_by` = user đó

#### Scenario: Xóa cứng khách hàng kéo theo sổ và dòng tiền (cascade)
- **WHEN** một khách bị xóa cứng khiến sổ và các dòng tiền bị cascade delete
- **THEN** mỗi dòng tiền bị cascade tạo đúng 1 dòng audit `payment_deleted`

### Requirement: Ghi vết sửa sổ liệu trình
Hệ thống SHALL tự động ghi một dòng audit (action `ledger_updated`) mỗi khi `service_ledgers.total_amount` hoặc `closed_at` thay đổi giá trị, gồm snapshot jsonb dòng cũ và dòng mới, người thực hiện và thời điểm. Update không chạm 2 cột này SHALL NOT tạo dòng audit.

#### Scenario: Đổi tổng giá liệu trình
- **WHEN** `setLedgerTotal` đổi `total_amount` từ 5.000.000 → 3.000.000
- **THEN** `money_audit` có 1 dòng `ledger_updated` với `old_data->>'total_amount'` = 5000000 và `new_data->>'total_amount'` = 3000000

#### Scenario: Tất toán / mở lại sổ
- **WHEN** `setLedgerClosed` set hoặc xóa `closed_at`
- **THEN** có 1 dòng audit `ledger_updated` ghi lại `closed_at` cũ → mới

#### Scenario: Update không đổi tiền
- **WHEN** một update trên `service_ledgers` giữ nguyên `total_amount` và `closed_at` (vd. chỉ trigger `updated_at`)
- **THEN** không có dòng audit mới

### Requirement: Audit bất biến, chỉ đọc
Bảng `money_audit` SHALL append-only đối với người dùng: role `authenticated` chỉ được SELECT; insert/update/delete bị revoke (Supabase default privileges tự grant nên phải thu hồi tường minh) — ghi duy nhất qua trigger `security definer`.

#### Scenario: User thường cố sửa audit
- **WHEN** một user đăng nhập chạy update/delete trên `money_audit`
- **THEN** thao tác bị từ chối vì thiếu quyền
