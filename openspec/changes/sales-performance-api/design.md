# Design: sales-performance-api

## Context

- Mỗi khách đã gắn `customers.sales_id` (migration `20260723080332`); tiền nằm ở `service_ledgers.total_amount` (sổ khách × dịch vụ) — đây là định nghĩa "Doanh thu"/"AOV" hiện hành của app (`/api/finance/revenue` + `calculateFinancialMetrics`).
- `profiles.department` đã có giá trị `sales` (migration `20260723062046`); select Sales/Kỹ thuật viên ở /customers và appointments đã lọc đúng bộ phận, riêng select "Nhân viên" (`staff_id`) và lead-form vẫn hiện mọi user.

## Goals / Non-Goals

**Goals:**
- 1 route đọc-only trả bảng chỉ số per-sales, tái dùng helper/pattern sẵn có (`supaRange`, `isValidDateRange`, paging PAGE_SIZE, `requireAdmin`).
- Lọc select người theo bộ phận, đồng nhất 3 vai trò.

**Non-Goals:**
- Không có UI card/bảng dashboard (làm khi user yêu cầu, như 2 API trước).
- Không so kỳ trước / growth (thêm khi UI cần).
- Không migration, không RPC/DB function.

## Decisions

1. **"Bill" = sổ `service_ledgers` đã báo giá (`total_amount` not null)** — khớp y nguyên định nghĩa `revenue`/`orderCount`/`aov` của `/api/finance/revenue`, số liệu 2 trang nhất quán. Alternative bị loại: `appointment_payments` (đó là "thực thu"/collected, không phải "doanh thu" theo quy ước app).
2. **Cohort theo khách tạo trong kỳ, bill trọn đời** — "Số khách" = khách mới trong kỳ của sales; tỉ lệ chốt đo trên đúng cohort đó nên bill tính trọn đời (khách chốt sau kỳ vẫn là chốt). Alternative bị loại: lọc bill theo `created_at` trong kỳ (khách tạo cuối kỳ chưa kịp có sổ → close rate méo).
3. **Danh sách sales = `department='sales'` ∪ `sales_id` xuất hiện trong cohort** — sales bị đổi bộ phận vẫn thấy số cũ; user chưa từng có khách vẫn hiện dòng 0 (đủ mặt để so sánh).
4. **Tính toán thuần tách vào `lib/financial.ts`** (`calculateSalesPerformance(customers, ledgers, salesList)`) + test `node --test` — route chỉ lo auth/validate/fetch, khớp pattern `calculateFinancialMetrics`.
5. **`staff_id` ánh xạ bộ phận `customer_care`** — 3 cột người trên khách (Nhân viên/Sales/Kỹ thuật viên) ↔ 3 giá trị enum (`customer_care`/`sales`/`technician`), mỗi select 1 bộ phận.

## Risks / Trade-offs

- [Bill trọn đời → revenue của kỳ cũ có thể tăng khi khách cũ mua thêm] → chấp nhận: đúng nghĩa "doanh thu từ khách sales đó mang về"; ghi rõ trong response `period`.
- [User chưa gán bộ phận `customer_care` → select Nhân viên rỗng] → giống hệ quả đã chấp nhận ở technician/sales trước đây; admin vào /users gán bộ phận.
- [Khách nhiều sổ cùng dịch vụ (đã tất toán + sổ mới) đều tính] → chủ đích: mỗi sổ là 1 đơn (khớp orderCount finance).
