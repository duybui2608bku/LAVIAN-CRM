# Proposal: service-stats-api

## Why

Đã có thống kê theo kỳ (`/api/finance/revenue`), theo lịch hẹn (`/api/appointments/summary`), theo phễu khách (`/api/customers/funnel`) và theo nhân viên sales (`/api/sales/performance`) — nhưng chưa có lát cắt **theo từng dịch vụ**: dịch vụ nào ra nhiều data, chốt được bao nhiêu lịch, bao nhiêu khách thực sự đến, mang về bao nhiêu doanh thu và giá trị trung bình mỗi đơn. Doanh thu upsales (`appointment_upsales`, có `service_id` riêng) hiện chỉ được cộng gộp toàn kỳ, chưa quy về dịch vụ được upsale.

## What Changes

- Thêm route mới `GET /api/services/stats?from&to` (gác admin, khớp finance/sales vì có số tiền): mỗi dịch vụ 1 dòng với
  - `data` — số khách TẠO trong kỳ (giờ VN, chưa xóa mềm) có gắn dịch vụ đó (`customer_services`);
  - `booked` — số **lượt lịch hẹn** có `scheduled_at` trong kỳ, chưa xóa mềm, dịch vụ đó;
  - `arrived` — trong số `booked`, số lượt đã đến (`checked_in_at is not null` — bắt cả ca "đến rồi hủy" vẫn giữ mốc check-in);
  - `revenue` = `baseRevenue` + `upsalesRevenue`, trong đó `baseRevenue` = Σ `total_amount` sổ `service_ledgers` của dịch vụ đó tạo trong kỳ (đã báo giá), `upsalesRevenue` = Σ `amount` các `appointment_upsales` **theo `service_id` của chính upsale**, tạo trong kỳ;
  - `orderCount` = số sổ đã báo giá + số record upsale; `aov` = `revenue / orderCount` (0 khi không có đơn).
- Helper thuần `calculateServiceStats` trong `lib/financial.ts` + test.
- Nới `serviceName()` (`lib/customers.ts`) nhận `Pick<Service, "name_vi"|"name_en"|"name_id">` để client dùng lại trực tiếp cho row API.
- Trang báo cáo `/`: thêm bảng **"Hiệu quả dịch vụ"** chiếm nửa hàng (ô thứ 3 của grid `xl:grid-cols-2` sẵn có, dưới bảng nhân viên/sales) — cột Dịch vụ / Data / Chốt lịch / Khách đến / Doanh thu / Trung bình đơn, có dòng Tổng, ẩn dịch vụ không phát sinh trong kỳ.
- KHÔNG đổi DB.

## Capabilities

### New Capabilities
- `service-stats-api`: API thống kê theo từng dịch vụ (data, chốt lịch, khách đến, doanh thu gồm upsales, AOV) theo khoảng ngày.

### Modified Capabilities

(không có — main specs hiện chỉ có `money-audit`, không liên quan)

## Impact

- Thêm `app/api/services/stats/route.ts`.
- Sửa `lib/financial.ts` (+ `lib/financial.test.ts`), `lib/customers.ts` (nới type tham số `serviceName`), `components/dashboard/marketing-stats.tsx`, `messages/{vi,en,id}.json` (+6 key).
- Không migration.
