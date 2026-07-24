# Tasks: service-stats-api

## 1. Helper thuần + test

- [x] 1.1 Thêm `calculateServiceStats(services, dataRows, appointmentRows, ledgerRows, upsaleRows)` vào `lib/financial.ts` (types row tối giản; sổ chưa báo giá bị bỏ; `orderCount` = sổ báo giá + upsale; `aov` = 0 khi `orderCount = 0`; sort revenue desc → tên)
- [x] 1.2 Thêm test vào `lib/financial.test.ts` (đủ 5 chỉ số, dịch vụ chỉ có upsale, sổ chưa báo giá, dịch vụ rỗng không chia 0, upsale tính cho dịch vụ được bán thêm)

## 2. Route API

- [x] 2.1 Tạo `app/api/services/stats/route.ts`: `requireAdmin` → validate `isValidDateRange` (400) → 5 query phân trang (`services`, `customer_services` + embed `customers!inner`, `appointment_services` + embed `appointments!inner`, `service_ledgers`, `appointment_upsales`) → `calculateServiceStats` → `Response.json({ data, currency, period })`; lỗi qua `normalizeError`
- [x] 2.2 Nới tham số `serviceName()` trong `lib/customers.ts` thành `Pick<Service, "name_vi"|"name_en"|"name_id">` để client dùng lại cho row API

## 3. Bảng trên trang báo cáo

- [x] 3.1 `components/dashboard/marketing-stats.tsx`: thêm state + `fetchApi<ServicesApiResponse>("/api/services/stats")` vào `Promise.all` sẵn có, `serviceRows` (lọc dịch vụ có phát sinh) + `servicesTotal`
- [x] 3.2 Section "Hiệu quả dịch vụ" làm phần tử thứ 3 của grid `xl:grid-cols-2` (nửa hàng), copy pattern bảng sales: SectionTitle + Table 6 cột + TableFooter Tổng + trạng thái rỗng/đang tải + dòng lỗi riêng
- [x] 3.3 i18n ×3: `servicesSection`, `serviceCol`, `serviceData`, `serviceBooked`, `serviceArrived`, `noServiceStats` (dùng lại `revenue`, `salesAov`, `total`, `loading`)

## 4. Kiểm chứng

- [x] 4.1 `node --test lib/financial.test.ts` + `npx tsc --noEmit` + eslint các file sửa
- [x] 4.2 Smoke API: không session → 403 đúng shape (dev server); 2 query embed chạy thật trên Supabase qua REST (filter cột embed đúng, quan hệ trả object). CHƯA test happy path session admin
- [x] 4.3 Cập nhật `memory-bank/README.md` (mục nhật ký + trạng thái)
