-- Mục đích: lần thu tiền của thẻ liệu trình đính kèm 1 hoặc nhiều ảnh (bill, chuyển khoản...).
-- Thứ tự chạy: SAU 20261122100000_treatment_cards.sql. Chạy lại an toàn.
-- Ảnh tải qua /api/upload (CDN ngoài), cột chỉ lưu URL — giống tours.extra_images.

alter table public.treatment_card_payments
  add column if not exists images text[] not null default '{}';

alter table public.treatment_card_payments drop constraint if exists treatment_card_payments_images_max;
alter table public.treatment_card_payments
  add constraint treatment_card_payments_images_max check (coalesce(array_length(images, 1), 0) <= 30);
