-- ============================================================================
-- Migration: Lưu nguyên payload SMAX vào customers.smax_data — LAVIAN-CRM
-- Copy toàn bộ file này vào Supabase SQL Editor và chạy 1 lần. Idempotent.
-- Phụ thuộc: 20260715100000_smax_customer_fields.sql đã chạy.
--
-- Nội dung:
--   * smax_data: jsonb — toàn bộ `data` của event `__SM_FORM_CUSTOMER`
--     (customer, thread, ...) lúc nhân viên bấm Gửi/Cập nhật ở /lead-form.
--     Các cột nhỏ (social_name, picture, tags, thread) vẫn giữ như cũ.
--     null với khách tạo tay hoặc tạo trước migration này.
-- ============================================================================

alter table public.customers add column if not exists smax_data jsonb;

-- ============================================================================
-- ROLLBACK (chạy nếu cần gỡ bỏ):
--   alter table public.customers drop column if exists smax_data;
-- ============================================================================
