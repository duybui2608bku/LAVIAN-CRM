## Why

Cần lưu 1 ảnh xác nhận thanh toán (Payment confirm) cho mỗi khách, nhập được ở cả CRM `/customers` lẫn Form SMAX.

## What Changes

- DB: cột mới `customers.payment_confirm_url text` (null = chưa có). Migration `20261112150000_customer_payment_confirm.sql`.
- `/customers`: drawer tạo/sửa thêm ô `ImageUpload` "Payment confirm" (1 ảnh, xoá được). `clean()` ghi cột này.
- Form SMAX (tab Customer info): thêm ô `ImageUpload` dưới hàng Stage/Deposit. Khách đã có → fill ảnh hiện tại
  (bỏ qua nếu ô đã chạm), đổi khách → reset. Submit/Update ghi URL (null = xoá).
- Upload qua `/api/upload` sẵn có (route `/api` không qua proxy.ts nên trang public gọi được).

## Impact

- `supabase/migrations/20261112150000_customer_payment_confirm.sql`, `types/customer.ts`,
  `app/(app)/customers/{page,actions}.ts(x)`, `components/customers/customers-manager.tsx`,
  `app/lead-form/actions.ts`, `components/lead-form/lead-form.tsx`, `messages/{en,vi}.json`.
