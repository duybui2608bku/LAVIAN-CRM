-- Mục đích: báo cáo /reports lấy Doanh thu từ thẻ liệu trình (cọc trừ vào thẻ + các lần thu) thay cho Hoá đơn tour
--   → người có quyền reports.view (không có cards.*) cũng phải đọc được treatment_cards + treatment_card_payments,
--   giống tours đã có reports.view trong policy đọc. Không đụng quyền ghi.
-- Thứ tự: SAU 20261122130000_rls_by_permission.sql (dùng public.has_permission). Chạy lại an toàn.

drop policy if exists treatment_cards_read on public.treatment_cards;
create policy treatment_cards_read on public.treatment_cards for select to authenticated
  using ((select public.has_permission('cards.view', 'cards.edit', 'cards.delete', 'reports.view')));

drop policy if exists treatment_card_payments_read on public.treatment_card_payments;
create policy treatment_card_payments_read on public.treatment_card_payments for select to authenticated
  using ((select public.has_permission('cards.view', 'cards.edit', 'cards.delete', 'reports.view')));
