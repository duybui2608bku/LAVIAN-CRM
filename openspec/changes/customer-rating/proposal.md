## Why

Cần đánh giá nhanh chất lượng khách (tiềm năng, chỉ hỏi giá, ở xa, spam) để lọc và ưu tiên chăm sóc.

## What Changes

- DB: cột `customers.rating text` (null = chưa đánh giá), không check ở DB. Migration `20261113140000_customer_rating.sql`.
- Giá trị **cố định trong code**, chọn 1: thêm kind `rating` vào `ENUM_KINDS` + `CUSTOMER_OPTIONS`
  (`potential` Tiềm năng · `price_only` Chỉ hỏi giá · `far` Ở xa · `spam` Spam). Helper `validRating()` — server
  validate, giá trị lạ → null. Trang `/enums` vẫn chỉ mở cho `lost_reason`.
- `/customers`: drawer có Giai đoạn | Đánh giá chung 1 hàng; bảng thêm cột "Đánh giá" sửa inline (bỏ chọn được) cạnh Giai đoạn;
  thanh lọc thêm "Tất cả đánh giá". `patchCustomer` whitelist thêm `rating`.
- Form SMAX: lưới 2x2 Giai đoạn | Đánh giá, Tiền cọc | Ảnh xác nhận; fill từ CRM như stage, ghi khi submit/update.

## Impact

- `supabase/migrations/20261113140000_customer_rating.sql`, `types/customer.ts`, `lib/customer-options.ts`,
  `lib/customers{,.test}.ts`, `app/(app)/enums/actions.ts`, `app/(app)/customers/{page,actions}.ts(x)`,
  `components/customers/customers-manager.tsx`, `app/lead-form/{page,actions}.ts(x)`, `components/lead-form/lead-form.tsx`,
  `messages/{en,vi}.json`.
