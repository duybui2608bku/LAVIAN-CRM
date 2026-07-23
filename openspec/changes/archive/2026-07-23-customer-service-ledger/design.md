# Design: customer-service-ledger

## Context

- Tiền hiện per lịch hẹn: `appointments.expected_amount`/`final_amount` (số phải thu) + sổ `appointment_payments` FK `appointment_id` (số đã thu). Hai bên độc lập, chỉ gặp nhau ở công thức `outstanding = (final ?? expected) − paidTotal` trong `lib/appointments.ts`.
- Dịch vụ per lịch: bảng nối `appointment_services`, UI multi-select, KHÔNG bắt buộc.
- 2 page (`/appointments`, `/customers`) nạp appointments bằng nested select 1 query; mọi ghi qua server action `app/(app)/appointments/actions.ts`.
- Đã chốt với user: **1 dịch vụ/lịch hẹn**, **đóng sổ thủ công**, **doanh thu ngày bỏ khỏi phạm vi** (thống kê làm sau ở menu riêng).

## Goals / Non-Goals

**Goals:**
- Một liệu trình (khách + dịch vụ) = MỘT sổ tiền: tổng giá + các lần thu dùng chung cho mọi buổi hẹn — sửa ở đâu cũng là sửa cùng 1 dòng (hết lệch 2 chiều).
- Tất toán được liệu trình để lần mua lại sau tính tiền từ đầu.
- Bắt buộc chọn dịch vụ khi đặt lịch; nhận diện khách cũ ngay trong bảng và form.

**Non-Goals:**
- Không làm báo cáo doanh thu/thực thu (menu thống kê riêng, làm sau) — chỉ gỡ dòng tổng ngày hiện tại.
- Không đổi máy trạng thái, stage khách, dòng sổ bất biến (giữ nguyên change `appointment-payments-ledger`).
- Không đổi schema `appointment_services` (giữ bảng nối, ràng buộc "đúng 1" ở app).
- Không hỗ trợ 2 sổ MỞ song song cho cùng (khách, dịch vụ).

## Decisions

### 1. Bảng `service_ledgers` — 1 sổ MỞ cho mỗi cặp (khách, dịch vụ)
```sql
create table service_ledgers (
  id           uuid pk default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete cascade,
  service_id   uuid not null references services(id) on delete restrict,
  total_amount numeric(12,2),          -- tổng giá liệu trình (null = chưa báo giá)
  closed_at    timestamptz,            -- null = đang mở; set khi bấm Tất toán
  created_by   uuid references profiles(id) on delete set null,
  created_at/updated_at timestamptz    -- trigger set_updated_at dùng chung
);
create unique index service_ledgers_open_uq
  on service_ledgers (customer_id, service_id) where closed_at is null;
```
- **Unique partial index** thay vì unique thường: cho phép nhiều sổ ĐÃ ĐÓNG (lịch sử mua lại) nhưng chỉ 1 sổ mở. Race 2 nhân viên tạo cùng lúc: insert `on conflict do nothing` → select lại.
- RLS authenticated toàn quyền + grant select/insert/update/delete (sổ CÓ update: total_amount, closed_at — khác dòng tiền bất biến).
- *Loại phương án tra cứu thuần (không bảng):* sau khi đóng sổ, lịch cũ phải tiếp tục chỉ về sổ cũ trong khi lịch mới về sổ mới — tra theo (khách, dịch vụ) lúc đọc không phân biệt được thế hệ sổ → cần dòng thật + FK.

### 2. Lịch hẹn và dòng tiền cùng trỏ về sổ
- `appointments.ledger_id uuid references service_ledgers(id) on delete set null` — con trỏ bền theo thế hệ sổ. Server resolve khi tạo/sửa: tìm sổ MỞ của (customer_id, service_id) → không có thì tạo (`resolveLedger`). Đổi dịch vụ/khách khi sửa → resolve lại + dời các dòng tiền `appointment_id = lịch này` sang sổ mới (sửa sai chỗ là kéo cả tiền đi theo).
- `appointment_payments.ledger_id uuid not null references service_ledgers(id) on delete cascade` (sau backfill); `appointment_id` **giữ lại, đổi thành nullable + on delete set null** — làm dấu vết "thu ở buổi nào", và để tiền SỐNG SÓT khi lịch hẹn bị xóa (tiền thuộc liệu trình, không thuộc buổi hẹn).
- Ngoại lệ dữ liệu cũ: lịch KHÔNG có dịch vụ thì không tạo được sổ → `ledger_id` của lịch để null; dòng tiền mồ côi của nó tạm giữ `ledger_id` qua sổ nào? Không có — backfill bỏ qua, app hiển thị fallback Σ payments theo `appointment_id` (đọc-only), dialog Thanh toán nhắc "chọn dịch vụ để mở sổ"; khi sửa lịch chọn dịch vụ → server nhận sổ + adopt các dòng mồ côi (`update ... set ledger_id where appointment_id = X and ledger_id is null`). Vì dữ liệu mới vài ngày tuổi, ca này gần như không tồn tại.

### 3. BREAKING: drop `expected_amount` + `final_amount` — tổng giá là 1 con số trên sổ
- Ví dụ của user chỉ có MỘT con số (500k dùng chung) → gộp báo giá/doanh số chốt thành `total_amount` trên sổ. Popover Hoàn tất đổi field "Doanh số chốt" → "Tổng giá liệu trình" (update sổ) + "Thu lần này" (dòng payment) giữ nguyên phần còn lại.
- `dayTotal` (Σ final lịch completed) mất nguồn dữ liệu và sẽ đếm trùng khi nhiều lịch chung sổ → **xóa hàm + dòng tổng UI + test** (user đã chốt: thống kê ở menu khác, làm sau từ `paid_at` của sổ).
- Backfill (bọc `do $$`, guard cột `expected_amount` còn tồn tại → idempotent):
  1. Gom mọi appointment (kể cả soft-deleted — tiền không được mất) có ≥1 dịch vụ theo (customer_id, dịch vụ nhỏ nhất theo `service_id` cho tất định) → tạo sổ mở/cặp; `total_amount = coalesce(final, expected)` của lịch MỚI NHẤT (created_at) có giá trong nhóm (heuristic 1 lần, note sửa tay nếu lệch).
  2. Set `appointments.ledger_id`; update `appointment_payments.ledger_id` theo appointment của dòng.
  3. Drop 2 cột tiền.
- Dòng tiền không backfill được (lịch không dịch vụ): `ledger_id` để null → cột thêm dạng nullable, **KHÔNG set not null** (chấp nhận, mọi dòng mới luôn có sổ từ server action).

### 4. Đóng / mở sổ
- Action `setLedgerClosed(id, closed: boolean)`: đóng set `closed_at = now()`, mở lại set null (mở lại phải không vi phạm unique sổ mở — vi phạm trả lỗi "Khách đang có sổ mở khác cho dịch vụ này").
- Sổ đóng: `addPayment` server từ chối ("Sổ đã tất toán."); UI dialog Thanh toán ẩn form thêm + hiện badge "Đã tất toán" + nút Mở lại; xóa dòng vẫn được (sửa sai sót lịch sử).
- Tạo lịch mới sau khi đóng: `resolveLedger` chỉ tìm sổ MỞ → tự tạo sổ mới, đúng yêu cầu "coi như mới".

### 5. Một dịch vụ / lịch hẹn — validate ở app, giữ nguyên schema bảng nối
- Form: `MultiSelect` → `ClearableSelect` đơn bắt buộc (`service_id` string, zod min(1)); submit gửi `service_ids: [service_id]`. Sửa lịch cũ nhiều dịch vụ: select hiện dịch vụ đầu, lưu = còn 1 (chấp nhận, ghi chú trong form không cần).
- Server `createAppointment`/`updateAppointment`: `service_ids?.length === 1` mới nhận, sai trả lỗi "Chọn đúng một dịch vụ." — trust boundary thật, không tin client.
- *Loại phương án cột `appointments.service_id` trực tiếp:* đúng hơn về mô hình nhưng phải dời dữ liệu + sửa mọi query/filter/`deleteService` guard — bảng nối sẵn có làm được y hệt với diff nhỏ hơn nhiều.
- `deleteService` thêm guard đếm `service_ledgers` (pattern đếm `customer_services`/`appointment_services` sẵn có; FK restrict là lưới đỡ cuối).

### 6. Nạp dữ liệu + helper
- 2 page nested thêm: `service_ledgers!appointments_ledger_id_fkey(*, appointment_payments(*))` — payments nằm DƯỚI SỔ (đủ mọi buổi), sort `paid_at desc` ở app như cũ; giữ nested `appointment_payments` theo appointment CHỈ cho fallback lịch không sổ.
- `types/appointment.ts`: interface `ServiceLedger {id, customer_id, service_id, total_amount, closed_at, payments}`; `Appointment` bỏ 2 field tiền, thêm `ledger_id` + `ledger: ServiceLedger | null`.
- `lib/appointments.ts`: `paidTotal(a)` = Σ theo `a.ledger?.payments`, fallback `a.payments` khi không sổ; `outstanding(a)` = `max(ledger.total − paid, 0)`; helper mới `ledgerPaid(l)` dùng chung. **/customers "Tổng đã trả" = Σ theo SỔ DISTINCT** (dedupe theo `ledger.id` — nhiều lịch chung sổ mà cộng per lịch là đếm trùng) + tiền mồ côi.
- Tag "Khách cũ": thuần suy diễn từ list appointments đã nạp — khách có lịch KHÁC (chưa xóa) `created_at` nhỏ hơn. Bảng: badge cạnh tên khách; drawer tạo: badge cạnh select khi khách đã có lịch. Không cột DB, không query thêm.

### 7. Luồng tiền trên form
- **Drawer tạo:** chọn khách + dịch vụ → client tìm sổ mở trong data đã nạp (qua appointments khác cùng khách + dịch vụ): thấy → prefill "Tổng giá" + hiện dòng phụ "Sổ hiện có — đã thu X, còn nợ Y"; không thấy → ô trống. Ô Cọc như cũ (dòng deposit ghi vào sổ resolve được). Server luôn là nguồn chân lý: `total_amount !== undefined` mới update sổ (user xóa trống = chủ đích set null).
- **Drawer sửa:** ô "Tổng giá" (sửa sổ) + "Đã thu" read-only + nút Thanh toán như cũ.
- **Dialog Thanh toán:** theo SỔ của lịch đang mở (title kèm tên dịch vụ), liệt kê dòng mọi buổi, thêm/xóa như cũ (thêm bị chặn khi sổ đóng), thêm nút Tất toán/Mở lại + badge trạng thái; chặn overpay client-side đổi mốc theo `ledger.total`.

## Risks / Trade-offs

- [Backfill đoán tổng giá = coalesce(final, expected) của lịch mới nhất trong nhóm] → dữ liệu mới vài ngày, chạy 1 lần; lệch thì sửa ngay ô Tổng giá (2 chiều).
- [Nhiều dòng bảng cùng ngày chung sổ hiện cùng số Đã thu/Còn nợ] → bản chất của tiền dùng chung, đúng kỳ vọng user.
- [Sửa lịch cũ nhiều dịch vụ ép còn 1] → mất tag dịch vụ phụ của lịch đó; chấp nhận (đã chốt 1 dịch vụ/lịch).
- [resolveLedger + insert lịch + dòng cọc không transaction] → giống pattern `syncServices` hiện có; lỗi giữa chừng thiếu dòng cọc, thêm lại qua dialog. Nâng RPC khi thành vấn đề thật.
- [2 nhân viên cùng tạo sổ] → unique partial index + `on conflict do nothing` + select lại.
- [Xóa cứng khách xóa cascade sổ + tiền] → hành vi hiện tại của appointments, nhất quán; khách chỉ soft-delete trong UI.

## Migration Plan

1. Chạy `supabase/migrations/<ts>_service_ledgers.sql` trong SQL Editor **SAU `20260715150000_appointment_payments.sql`**: bảng + index + RLS + 2 cột FK mới + backfill + drop `expected_amount`/`final_amount`. Idempotent.
2. Deploy code cùng lúc (code mới đọc `service_ledgers`, không còn tham chiếu 2 cột tiền).
3. Rollback (mất chia sẻ sổ, khôi phục tiền per lịch): add lại 2 cột, copy `total_amount` của sổ về các lịch trỏ tới nó, `update appointment_payments set ledger_id = null` khỏi cần — drop 2 cột FK + drop bảng. Script chi tiết ghi cuối file migration.

## Open Questions

- Không còn — 3 quyết định lớn (1 dịch vụ/lịch, đóng sổ thủ công, doanh thu để menu thống kê sau) đã chốt với user.
