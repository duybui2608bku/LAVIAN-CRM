# Design: appointment-payments-ledger

## Context

- `appointments` hiện có 3 cột tiền tĩnh: `expected_amount` (báo giá), `deposit_amount` (cọc, default 0), `final_amount` (doanh số chốt); `payment_method` 1 giá trị cho cả lịch. Sisa = `(final ?? expected) − deposit` tính ở app (`lib/appointments.ts:outstanding`).
- `setAppointmentStatus` nhận MỌI status hợp lệ (chỉ check tồn tại trong `APPOINTMENT_STATUSES`) — không có khái niệm transition, không có hoàn tác. Trigger `log_appointment_status` đã audit đầy đủ mọi lần đổi.
- Đã có sẵn hạ tầng ảnh: bucket public `images` (RLS ghi theo `{user_id}/`), helper `lib/supabase/storage.ts`, component `components/common/image-upload.tsx`.
- 2 page (`/appointments`, `/customers`) đều nạp appointments bằng nested select PostgREST một query.

## Goals / Non-Goals

**Goals:**
- Hoàn tác được thao tác trạng thái bấm nhầm; ghi nhận được ca "đến nhưng không làm dịch vụ".
- Mọi lần tiền vào/ra (cọc, thu khi hoàn tất, thu thêm, hoàn cọc) là một dòng sổ có ngày, phương thức, ảnh chứng từ, người tạo — không sửa đè con số cũ.
- Trả lời được "khách này đã trả tổng bao nhiêu" = Σ sổ qua mọi lịch hẹn của khách.

**Non-Goals:**
- Không thêm status mới (giữ 6 status hiện có, check constraint không đổi).
- Không làm module kế toán: không đối soát, không số dư ví khách, không xuất báo cáo — chỉ sổ ghi nhận per lịch hẹn.
- Không tự hạ `customer.stage` khi hoàn tác (stage chỉ đi tiến — chỉnh tay inline ở /customers nếu cần).
- Không đổi cách tính "doanh thu ngày" (`dayTotal` = Σ `final_amount` lịch completed) — doanh số ≠ thực thu; báo cáo thực thu theo `paid_at` làm sau khi cần.

## Decisions

### 1. Transition whitelist ở server action, không phải DB
Map hardcode trong `actions.ts`:

| từ \ tới | booked | checked_in | completed | no_show | cancelled |
|---|---|---|---|---|---|
| pending_confirmation | ✔ (chốt ngày) | | | | ✔ |
| booked | | ✔ | | ✔ | ✔ |
| checked_in | ✔ **hoàn tác** | | ✔ | | ✔ **đến không làm** |
| completed | | ✔ **hoàn tác** | | | |
| no_show | ✔ đặt lại | | | | |
| cancelled | ✔ đặt lại | | | | |

- Hoàn tác XÓA timestamp mốc của trạng thái vừa rời (`checked_in→booked` xóa `checked_in_at`; `completed→checked_in` xóa `completed_at`). `cancelled→booked` (đặt lại lịch, đã có) xóa `cancelled_at`.
- "Đến nhưng không làm dịch vụ" = `checked_in → cancelled` (+ ghi chú tùy chọn); thống kê phân biệt với hủy trước hẹn bằng `cancelled` có `checked_in_at is not null`. *Loại phương án thêm status mới:* phải sửa check constraint + STATUS_META + i18n + mọi switch, trong khi timestamp đã phân biệt được.
- *Loại phương án enforce bằng trigger DB:* tool nội bộ, mọi ghi đều qua server action; trigger thêm một chỗ phải đồng bộ map. History trigger sẵn có đã đảm bảo audit dù ai đổi kiểu gì.
- Hoàn tác `completed→checked_in` KHÔNG tự xóa dòng tiền đã ghi lúc hoàn tất — người dùng tự xóa dòng sai trong dialog Thanh toán (tiền và trạng thái là 2 sổ độc lập).

### 2. Bảng `appointment_payments` — kind + amount dương, dòng bất biến
```sql
create table appointment_payments (
  id             uuid pk default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  kind           text not null check (kind in ('deposit','payment','refund')),
  amount         numeric(12,2) not null check (amount > 0),
  payment_method text check (payment_method in ('bank','cash','card')),
  image_url      text,          -- public URL bucket images (ảnh chứng từ)
  note           text,
  paid_at        timestamptz not null default now(),
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
```
- **kind + amount dương** thay vì amount có dấu: UI/báo cáo đọc thẳng ("Hoàn 500k" thay vì "-500000"); Đã thu = `Σ(deposit,payment) − Σ(refund)`.
- **Không có update** — sửa sai = xóa dòng + thêm lại (dialog có xóa kèm AlertDialog); hoàn tiền thật = dòng `refund`. Khỏi cần updated_at/trigger.
- RLS authenticated toàn quyền (đồng nhất appointments); index `(appointment_id, paid_at desc)`.
- FK cascade theo appointment: appointment soft-delete nên sổ không mất; chỉ mất khi xóa cứng (hành vi hiện tại của services/history tương tự).

### 3. BREAKING: drop `appointments.deposit_amount`, backfill vào sổ
- Giữ `expected_amount` (báo giá) + `final_amount` (doanh số chốt LẦN hẹn này) — trả lời thắc mắc "final_amount bị ghi đè": nó vốn per-appointment, mỗi lần hẹn có doanh số riêng; cái thiếu là lịch sử THU, nay có sổ.
- Backfill trong cùng migration, bọc `do $$` check cột `deposit_amount` còn tồn tại (chạy lại = no-op):
  1. `deposit_amount > 0` → dòng `deposit` (method = `payment_method` của lịch nếu có, `paid_at = created_at`).
  2. `status = 'completed'` và `final_amount > deposit_amount` → dòng `payment` amount = `final − deposit` (`paid_at = coalesce(completed_at, updated_at)`).
  3. `drop column deposit_amount`.
  Sau backfill: Đã thu của lịch completed = final (khớp tổng cũ), lịch khác = cọc cũ. Hai dòng backfill `created_by = null`, note đánh dấu `'backfill'`.
- `Appointment.payments: AppointmentPayment[]` map từ nested select `appointment_payments(*)` ở cả 2 page; helper `paidTotal(a)` và `outstanding(a)` đổi công thức sang sổ.

### 4. Luồng UI tiền
- **Tạo lịch (drawer):** giữ ô "Cọc" + thêm `ImageUpload` ảnh cọc (chỉ mode tạo) → server tạo lịch xong insert dòng `deposit` (amount > 0 mới ghi). Stage `deposited` vẫn nâng theo cọc này.
- **Sửa lịch (drawer):** ẩn ô Cọc; hiện "Đã thu" read-only + nút mở dialog Thanh toán. `expected`/`final` vẫn sửa được.
- **Dialog Thanh toán** (`components/appointments/payments-dialog.tsx`, mở từ nút icon Wallet ở cột thao tác + từ drawer sửa): bảng dòng sổ (ngày, loại tag, số tiền, phương thức, ảnh thumbnail click mở tab, ghi chú, người tạo) + dòng tổng Đã thu/Còn nợ + form thêm (loại thu/hoàn, CurrencyInput, phương thức, ImageUpload, ghi chú) + xóa dòng (AlertDialog).
- **Popover Hoàn tất:** thành 4 field — Doanh số chốt (final, prefill expected), "Thu lần này" (prefill `final − đã thu`), phương thức, ảnh. Submit = `setAppointmentStatus(completed, {final_amount}) `+ dòng `payment` nếu thu > 0 (server làm cả hai trong 1 action).
- **Bảng /appointments:** cột "Cọc" → "Đã thu"; Còn nợ = `(final ?? expected) − đã thu` (không âm). **/customers** dialog lịch sử: mỗi lịch hiện Đã thu, cuối dialog dòng "Tổng đã trả" = Σ mọi lịch.
- **Hoàn tác:** nút icon `Undo2` ở quickActions nhóm `checked_in` (→booked) và `completed` (→checked_in); "đến không làm" = nút Ban sẵn có mở rộng cho `checked_in`.

## Risks / Trade-offs

- [Backfill đoán `payment` = final − deposit cho lịch completed] → chỉ chạy 1 lần, dòng có note `backfill` để nhận diện; sai lệch cá biệt sửa tay trong dialog Thanh toán.
- [2 lệnh insert lịch + insert cọc không transaction] → giống pattern `syncServices` hiện có; lỗi giữa chừng chỉ thiếu dòng cọc, thêm lại qua dialog. Nâng RPC khi thành vấn đề thật.
- [Ảnh chứng từ nằm bucket public `images`] → URL khó đoán (uuid) nhưng ai có link xem được; chấp nhận cho tool nội bộ (đồng nhất avatar khách SMAX). Cần riêng tư thì chuyển bucket private + signed URL sau.
- [Xóa dòng sổ tự do (authenticated)] → tin nội bộ + có `created_by`; siết role admin khi cần.
- [Hoàn tác không hạ stage khách] → chấp nhận (stage chỉ đi tiến theo thiết kế cũ), chỉnh inline ở /customers.

## Migration Plan

1. Chạy `supabase/migrations/<ts>_appointment_payments.sql` trong SQL Editor (SAU `20260710130000_appointments.sql`): tạo bảng + RLS + backfill + drop cột. Idempotent.
2. Deploy code cùng lúc (code mới đọc `appointment_payments`, không còn tham chiếu `deposit_amount`).
3. Rollback: `drop table appointment_payments;` + `alter table appointments add column deposit_amount numeric(12,2) not null default 0;` (mất phân rã sổ, tổng có thể khôi phục từ backfill note).

## Open Questions

- Không còn — các lựa chọn đã chốt theo hướng tối giản ở trên.
