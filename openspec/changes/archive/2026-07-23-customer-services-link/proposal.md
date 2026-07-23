# Proposal: Gắn dịch vụ cho khách hàng (customer ↔ service)

## Why

Bảng `services` đã có CRUD ở `/services` nhưng chưa liên kết gì với khách hàng — không ghi nhận được khách quan tâm/dùng dịch vụ nào, và không lọc được danh sách khách theo dịch vụ. Đây là bước nối nghiệp vụ đã được ghi chú từ session trước ("Service chưa gắn vào customers").

## What Changes

- **DB:** bảng nối `public.customer_services` (khóa ngoại `customer_id → customers` cascade, `service_id → services` restrict; PK kép) — một khách gắn được nhiều dịch vụ. RLS cho mọi user đăng nhập (giống `customers`).
- **/customers:** dialog tạo/sửa chọn nhiều dịch vụ (chip toggle); bảng thêm cột "Dịch vụ" (badge); thanh lọc thêm bộ lọc theo dịch vụ (client-side như các bộ lọc hiện có).
- **/services:** `deleteService` chặn xóa khi dịch vụ đang gắn với khách hàng (pattern `deleteOption` có sẵn — gợi ý tắt "Kích hoạt").
- i18n vi/en/id cho các nhãn mới.

## Capabilities

### New Capabilities
- `customer-services`: liên kết nhiều-nhiều khách hàng ↔ dịch vụ — lưu trữ (bảng nối + RLS), gắn/bỏ dịch vụ khi tạo/sửa khách, hiển thị trên bảng khách, lọc khách theo dịch vụ, và chặn xóa dịch vụ đang được dùng.

### Modified Capabilities
<!-- openspec/specs/ chưa có spec chính nào — không có delta. Ràng buộc xóa service ghi trong capability mới. -->

## Impact

- **DB (chạy tay):** migration mới `supabase/migrations/20260710120000_customer_services.sql` (phụ thuộc `20260707140000_customers_and_enums.sql` + `20260710100000_services.sql`).
- **Code:** `types/customer.ts` (Customer.service_ids, CustomerInput.service_ids), `lib/customers.ts` (+filter serviceId, +serviceName fallback) + test, `app/(app)/customers/{page,actions}.tsx` (query nested + ghi bảng nối), `components/customers/customers-manager.tsx` (cột, chip toggle, bộ lọc), `app/(app)/services/actions.ts` (check usage), `messages/{vi,en,id}.json`.
- Không đổi proxy/RLS services; không thêm dependency.
