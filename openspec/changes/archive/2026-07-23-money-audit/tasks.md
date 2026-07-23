## 1. Migration

- [x] 1.1 Tạo `supabase/migrations/20260723100000_money_audit.sql`: bảng `money_audit` (id, action check `payment_deleted|ledger_updated`, record_id, old_data jsonb not null, new_data jsonb, changed_by FK profiles set null, changed_at default now) + index `(changed_at desc)`
- [x] 1.2 Function + trigger `after delete` trên `appointment_payments` (security definer, `to_jsonb(old)`, `auth.uid()`)
- [x] 1.3 Function + trigger `after update` trên `service_ledgers` với WHEN chỉ bắt đổi `total_amount`/`closed_at` (`to_jsonb(old)` + `to_jsonb(new)`)
- [x] 1.4 RLS: enable + policy select-only cho authenticated, grant select (KHÔNG grant insert/update/delete); comment đầu file (mục đích, thứ tự chạy sau `20260723090000`) + khối ROLLBACK cuối file

## 2. Kiểm chứng

- [x] 2.1 Soát idempotent: chạy file 2 lần liên tiếp không lỗi (create table if not exists / create or replace / drop trigger if exists)
- [x] 2.2 Viết sẵn khối SQL smoke-test (comment cuối file hoặc đưa user chạy tay): insert dòng tiền giả → delete → thấy dòng `payment_deleted`; update `total_amount` → thấy `ledger_updated`; update no-op → không thêm dòng; user authenticated update `money_audit` → bị từ chối
- [x] 2.3 Cập nhật `memory-bank/README.md` (bullet trạng thái + mục nhật ký session, ghi rõ ⚠️ cần chạy migration tay)
