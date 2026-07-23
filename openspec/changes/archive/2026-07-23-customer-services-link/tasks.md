# Tasks: customer-services-link

## 1. Database

- [x] 1.1 Migration `supabase/migrations/20260710120000_customer_services.sql`: bảng `customer_services` (FK cascade/restrict, PK kép), index `service_id`, RLS authenticated toàn quyền + grant. Idempotent, comment phụ thuộc.

## 2. Types + helper thuần

- [x] 2.1 `types/customer.ts`: `Customer.service_ids: string[]`; `CustomerInput.service_ids?: string[]`.
- [x] 2.2 `lib/customers.ts`: `CustomerFilters.serviceId` + check trong `matchesCustomerFilters`; helper `serviceName(service, locale)` fallback `name_vi`.
- [x] 2.3 `lib/customers.test.ts`: case lọc theo serviceId (có/không) + fallback serviceName.

## 3. Server

- [x] 3.1 `app/(app)/customers/page.tsx`: nested select `customer_services(service_id)` → map `service_ids`; query thêm `services`; truyền props.
- [x] 3.2 `app/(app)/customers/actions.ts`: `createCustomer` insert → lấy id → insert dòng nối; `updateCustomer` delete-all-insert dòng nối theo `service_ids` (helper `syncServices`, không gửi = giữ nguyên).
- [x] 3.3 `app/(app)/services/actions.ts`: `deleteService` đếm `customer_services` (head count), >0 → trả lỗi kèm số liên kết, gợi ý tắt Kích hoạt.

## 4. UI /customers

- [x] 4.1 Dialog tạo/sửa: khối chip toggle chọn nhiều dịch vụ (active + đang gắn).
- [x] 4.2 Bảng: cột "Dịch vụ" (badge tên theo locale, trống "—"), colSpan empty 9→10.
- [x] 4.3 Thanh lọc: `ClearableSelect` dịch vụ nối vào filter.

## 5. Multi-select dịch vụ (feedback: thay chip bằng select + inline bảng)

- [x] 5.1 `components/common/multi-select.tsx`: component `MultiSelect` dùng chung (trigger style SelectTrigger, badge đã chọn/placeholder, children thay nội dung trigger; popover toggle + check).
- [x] 5.2 Dialog: thay chip toggle bằng `MultiSelect` (Controller `service_ids`, placeholder `pickServices`).
- [x] 5.3 Bảng: cột Dịch vụ thành `InlineServices` (MultiSelect trigger = badge, draft nội bộ, lưu 1 lần khi đóng popover nếu đổi — so như tập hợp).
- [x] 5.4 `patchCustomer`: whitelist thêm `service_ids` → `syncServices`.

## 6. i18n + kiểm chứng

- [x] 6.1 `messages/{vi,en,id}.json`: `customers.{colServices, allServices, pickServices}`; message chặn xóa hardcode tiếng Việt (đồng nhất `deleteOption`).
- [x] 6.2 `node --test lib/customers.test.ts` 7/7 PASS; `tsc --noEmit` sạch; `next build` PASS (cả sau khi chuyển multi-select).
- [x] 6.3 Cập nhật memory-bank/README.md.
