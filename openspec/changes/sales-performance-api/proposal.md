# Proposal: sales-performance-api

## Why

Chưa có chỗ nào xem được hiệu suất của từng nhân viên Sales dù mỗi khách hàng đã được gắn 1 sales (`customers.sales_id`) và tiền đã nằm trong sổ `service_ledgers`. Cần một API trả về Số khách / Doanh thu / AOV / Tỉ lệ chốt theo từng sales để trang báo cáo dùng sau. Đồng thời select "Nhân viên" trên bảng /customers và lead-form vẫn liệt kê MỌI user (sales/kỹ thuật viên đã lọc theo bộ phận rồi) — cần lọc thống nhất theo bộ phận.

## What Changes

- Thêm route mới `GET /api/sales/performance?from&to` (gác admin): với mỗi nhân viên Sales, trả về
  - `customers` — số khách được gắn cho sales đó, TẠO trong kỳ (`created_at`, giờ VN, chưa xóa mềm);
  - `revenue` — Σ `total_amount` các sổ `service_ledgers` (đã báo giá) của các khách đó;
  - `billCount` + `aov` — số sổ đã báo giá và `revenue / billCount`;
  - `closedCustomers` + `closeRate` — khách có ≥1 sổ đã báo giá = "chốt"; tỉ lệ = chốt / số khách.
- Lọc select nhân viên theo bộ phận, thống nhất với select Sales/Kỹ thuật viên sẵn có:
  - /customers: select "Nhân viên" (`staff_id` — bộ lọc, inline bảng, form drawer) chỉ hiện user `department = 'customer_care'` + giá trị đang gán.
  - Lead-form: select "Nhân viên tư vấn" (ghi `staff_id`) chỉ query user `department = 'customer_care'`.
- KHÔNG đổi DB, KHÔNG đổi UI dashboard (card dùng API này làm sau khi user yêu cầu).

## Capabilities

### New Capabilities
- `sales-performance-api`: API thống kê doanh số theo nhân viên Sales (số khách, doanh thu, AOV, tỉ lệ chốt) theo khoảng ngày.
- `staff-select-department-filter`: mọi select chọn người theo vai trò chỉ liệt kê user đúng bộ phận (`customer_care` / `sales` / `technician`) + giá trị đang gán.

### Modified Capabilities

(không có — main specs hiện chỉ có `money-audit`, không liên quan)

## Impact

- Thêm `app/api/sales/performance/route.ts` (+ helper thuần trong `lib/financial.ts` nếu cần, có test).
- Sửa `components/customers/customers-manager.tsx` (staffOptions → lọc customer_care), `app/lead-form/page.tsx` (query profiles thêm `.eq("department", "customer_care")`).
- Không migration, không i18n key mới, không đổi component appointments (technician đã lọc đúng).
