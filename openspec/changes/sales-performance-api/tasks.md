# Tasks: sales-performance-api

## 1. Helper thuần + test

- [x] 1.1 Thêm `calculateSalesPerformance(salesList, customers, ledgers)` vào `lib/financial.ts` (types row tối giản; revenue/billCount chỉ sổ `total_amount` not null; aov=0 khi billCount=0; closeRate=0 khi customers=0)
- [x] 1.2 Thêm test vào `lib/financial.test.ts` (đủ số liệu, khách không bill, sổ chưa báo giá, sales 0 khách, chia 0)

## 2. Route API

- [x] 2.1 Tạo `app/api/sales/performance/route.ts`: `requireAdmin` → validate `isValidDateRange` (400) → fetch phân trang (profiles sales, customers cohort theo `supaRange`, ledgers `.in("customer_id", batch)`) → `calculateSalesPerformance` → `Response.json({ data, period })`; lỗi qua `normalizeError`

## 3. Lọc select theo bộ phận

- [x] 3.1 `components/customers/customers-manager.tsx`: `staffOptions` → hàm `(staff, current?)` lọc `department === "customer_care"` + current; áp cho bộ lọc, inline `staff_id`, drawer
- [x] 3.2 `app/lead-form/page.tsx`: query profiles thêm `.eq("department", "customer_care")`

## 4. Kiểm chứng

- [x] 4.1 `node --test lib/financial.test.ts` + `npx tsc --noEmit` + eslint các file sửa
- [x] 4.2 Smoke API: không session → 401/403 đúng shape; range sai → 400
- [x] 4.3 Cập nhật `memory-bank/README.md` (mục nhật ký + trạng thái)
