# Proposal: drop-dead-finance-fields

## Why

Từ khi có **Thẻ liệu trình** (2026-11-22), tài chính chỉ nằm ở thẻ: giá trị DV = `treatment_card_items.price`, thu/hoàn = `treatment_card_payments`. Lịch hẹn và tour vẫn còn các cột tiền / ghi chú đời cũ, không ai nhập nữa nhưng vẫn được đọc ở vài chỗ, dễ hiểu nhầm (vd. "Bill" trên tour tưởng là hoá đơn thu tiền).

Số liệu DB thật (2026-11-23): `clinic_appointments.bill_amount/paid_amount` = 0 dòng có giá trị; `note`/`sales_note` (text) đã chuyển hết sang `notes`/`sales_notes` (jsonb); tour còn sống đều có `card_item_id` và `bill_amount` = giá dòng thẻ (0 lệch); `payment_method` = 0 dòng tour sống; `claimed_at`/`confirmed_by` chỉ được ghi, không ai đọc (lịch sử đã có ở `card_audit`).

## What Changes

- **DROP cột** `clinic_appointments`: `bill_amount`, `paid_amount`, `note`, `sales_note`.
- **DROP cột** `tours`: `bill_amount`, `payment_method`, `note`, `claimed_at`, `confirmed_by`.
- Tour: tiền tour (cột Bill, tổng bill, công Master, phiếu in, xuất Excel) đọc **giá DV trong thẻ** qua embed `...treatment_card_items(bill_amount:price)` — UI giữ nguyên tên trường, không còn bản sao tiền ở tour.
- Lịch hẹn: bỏ `bill_amount/paid_amount` khỏi schema patch, quy tắc `billBelowCollected`, select trang Sales Management, type.
- RLS: policy đọc `treatment_card_items` thêm quyền `tour.*` + `reports.view` (Master chỉ có quyền tour vẫn thấy tiền + công tour; sếp chốt).
- Trigger DB: `log_clinic_appointment_change` bỏ 4 cột; `tours_card_guard` bỏ điều kiện `bill_amount`; `tours_audit` bỏ `bill_amount` khỏi danh sách cột; `tours_protect_confirmation` bỏ `confirmed_by`.
- Nhật ký cũ (`clinic_appointment_logs`) vẫn hiển thị được các thay đổi tiền/ghi chú cũ (giữ nhãn hiển thị).

## Non-goals

- **Tiền cọc giữ ở hồ sơ khách** (`customers.deposit_amount`, `payment_confirm_url`) — nhận cọc lúc chưa có thẻ, thẻ trừ cọc như hiện tại (sếp chốt).
- Đổi tên nhãn "Bill" trên UI tour.

## Impact

- DB: migration `supabase/migrations/20261123100000_drop_dead_finance_fields.sql` (chạy **sau** khi deploy code).
- Code: `types/{tour,appointment,customer-360}.ts`, `lib/{appointments,cards,tours}.ts` (+test), `app/(app)/appointments/{actions.ts,page.tsx}`, `app/(app)/cards/actions.ts`, `app/(app)/tour/actions.ts`, `app/(app)/customers/customer-360-actions.ts`, `messages/*.json`.
