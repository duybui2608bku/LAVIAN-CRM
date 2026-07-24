# sales-performance-api — Delta Spec

## ADDED Requirements

### Requirement: API thống kê doanh số theo nhân viên Sales
Hệ thống SHALL cung cấp `GET /api/sales/performance?from=YYYY-MM-DD&to=YYYY-MM-DD` (gác admin) trả về, với mỗi nhân viên Sales (`profiles.department = 'sales'` HOẶC user đang được gắn `customers.sales_id` trong cohort), các chỉ số:
- `customers`: số khách `deleted_at is null`, `sales_id` = user đó, `created_at` trong kỳ (quy đổi giờ VN qua `supaRange`);
- `revenue`: Σ `total_amount` của mọi sổ `service_ledgers` đã báo giá (`total_amount` not null) thuộc các khách đó (trọn đời, không giới hạn kỳ);
- `billCount`: số sổ đã báo giá đó; `aov` = `revenue / billCount` (0 khi không có sổ);
- `closedCustomers`: số khách có ≥1 sổ đã báo giá; `closeRate` = `closedCustomers / customers` (%; 0 khi `customers = 0`).

#### Scenario: Trả số liệu đúng theo kỳ
- **WHEN** admin gọi `GET /api/sales/performance?from=2026-07-01&to=2026-07-24` và sales A có 4 khách tạo trong kỳ, trong đó 2 khách có sổ báo giá tổng 30.000.000 (3 sổ)
- **THEN** phần tử của A trả `customers=4`, `revenue=30000000`, `billCount=3`, `aov=10000000`, `closedCustomers=2`, `closeRate=50`

#### Scenario: Khách không có bill không tính là chốt
- **WHEN** một khách trong cohort chỉ có sổ chưa báo giá (`total_amount` null) hoặc không có sổ nào
- **THEN** khách đó không được đếm vào `closedCustomers` và sổ chưa báo giá không đóng góp vào `revenue`/`billCount`

#### Scenario: Chặn không phải admin
- **WHEN** request không có session admin
- **THEN** trả lỗi `{ error: { code, message } }` với status 401/403, không lộ số liệu

#### Scenario: Khoảng ngày không hợp lệ
- **WHEN** `from`/`to` thiếu, sai định dạng, hoặc `from > to`
- **THEN** trả 400 `INVALID_DATE_RANGE`

#### Scenario: Không dính trần 1.000 row
- **WHEN** cohort có hơn 1.000 khách hoặc hơn 1.000 sổ
- **THEN** API vẫn đếm/cộng đủ (query phân trang theo pattern `/api/finance/revenue`)
