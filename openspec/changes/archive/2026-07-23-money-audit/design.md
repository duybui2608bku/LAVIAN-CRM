## Context

Tiền nằm ở 2 bảng: `appointment_payments` (dòng bất biến — không grant update, nhưng **delete tự do**) và `service_ledgers` (`total_amount` = doanh số, `closed_at` = tất toán — **update tự do**). Không có log. Dự án đã có sẵn pattern audit: `appointment_status_history` + trigger `log_appointment_status` (security definer, `auth.uid()`), hoạt động tốt.

## Goals / Non-Goals

**Goals:**
- Mọi lần xóa dòng tiền / đổi tổng giá / đổi trạng thái tất toán đều để lại vết: ai, lúc nào, dữ liệu cũ (và mới nếu là update).
- Ghi ở tầng DB (trigger) — app không thể quên, insert thẳng qua SQL cũng bị ghi vết.
- Migration idempotent, chạy tay trong SQL Editor, có ROLLBACK.

**Non-Goals:**
- KHÔNG có UI xem audit (truy vết bằng SQL khi cần — làm UI khi có nhu cầu thật).
- KHÔNG chặn/đổi hành vi ghi tiền hiện tại (chặn thu vượt bằng trigger là việc khác, làm riêng).
- KHÔNG khôi phục dữ liệu đã sửa/xóa trước khi cài audit.
- KHÔNG audit insert (dòng tiền đã tự mang `created_by`/`created_at`).

## Decisions

1. **1 bảng chung `money_audit` cho cả 2 loại sự kiện** (thay vì 2 bảng riêng): phân biệt bằng cột `action` (`payment_deleted` | `ledger_updated`). Ít bảng, query truy vết 1 chỗ; jsonb chứa snapshot nên không cần cột riêng theo schema từng bảng.
2. **Snapshot nguyên dòng bằng `to_jsonb(old)` / `to_jsonb(new)`** thay vì tách cột giá trị cũ/mới: không phải chọn cột, tự sống sót khi bảng nguồn thêm cột về sau. Đọc bằng `old_data->>'total_amount'`.
3. **Trigger `after delete` trên `appointment_payments`** ghi `old_data`, `new_data` null. Cascade delete (xóa cứng khách → sổ → dòng tiền) cũng kích trigger từng dòng → tiền mất vì cascade vẫn có vết.
4. **Trigger `after update` trên `service_ledgers`** với `WHEN (old.total_amount is distinct from new.total_amount or old.closed_at is distinct from new.closed_at)` — update chỉ chạm `updated_at` không tạo rác audit.
5. **Không FK từ `record_id` về bảng nguồn** (dòng đã xóa thì không còn để tham chiếu); `changed_by` FK `profiles` on delete set null — copy đúng `appointment_status_history`.
6. **RLS: authenticated chỉ SELECT.** Không grant insert/update/delete — bảng append-only, ghi duy nhất qua trigger security definer (chạy quyền owner, không cần grant). Khác `appointment_status_history` (có grant insert để ghi note tay) — audit tiền không có nhu cầu đó.
7. **1 index `(changed_at desc)`** — truy vết chủ yếu theo thời gian; bảng chỉ lớn theo số lần xóa/sửa (hiếm), không cần thêm index.

## Risks / Trade-offs

- [Chạy SQL trực tiếp trong SQL Editor với quyền postgres → `auth.uid()` null] → `changed_by` null nhưng vẫn có snapshot + thời điểm; chấp nhận (SQL Editor chỉ admin dùng).
- [Đổi `total_amount` nhiều lần liên tiếp tạo nhiều dòng audit] → đúng chủ đích (mỗi lần đổi là 1 vết), bảng vẫn nhỏ.
- [Audit không tự khôi phục dữ liệu] → ngoài phạm vi; snapshot jsonb đủ để khôi phục tay khi cần.

## Migration Plan

1 file `supabase/migrations/20260723100000_money_audit.sql` (chạy sau `20260723090000`): tạo bảng + 2 function + 2 trigger + RLS. Idempotent (`create table if not exists`, `create or replace function`, `drop trigger if exists`). ROLLBACK ở cuối file: drop 2 trigger, 2 function, 1 bảng.

## Open Questions

(không — phạm vi đã chốt với user: chỉ DB, không UI)
