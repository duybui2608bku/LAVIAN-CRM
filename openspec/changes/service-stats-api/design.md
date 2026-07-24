# Design: service-stats-api

## Quyết định đã chốt với user

| Câu hỏi | Chốt |
|---|---|
| Đơn vị đếm `booked`/`arrived` | **Lượt lịch hẹn** (1 khách đặt 3 lịch = 3) — khớp `/api/appointments/summary` |
| Mốc lọc kỳ cho `booked`/`arrived` | **`scheduled_at`** trong kỳ (khớp API lịch hẹn + dashboard hiện tại) |
| Doanh thu | Gồm cả upsales (yêu cầu trực tiếp của user) |

## Định nghĩa từng chỉ số

Mọi mốc thời gian quy đổi giờ VN bằng `supaRange(from, to)` (nửa mở `[from−1 17:00Z, to 17:00Z)`), y như các API thống kê sẵn có.

- **`data`** — `customer_services` join `customers!inner` với `customers.created_at` trong kỳ và `deleted_at is null`. PK kép `(customer_id, service_id)` nên mỗi khách chỉ đếm 1 lần cho mỗi dịch vụ. Không dùng cohort lịch hẹn: "data" là khách quan tâm dịch vụ, có trước khi chốt lịch.
- **`booked`** — `appointment_services` join `appointments!inner` với `scheduled_at` trong kỳ, `deleted_at is null`. **Không lọc status**: lịch bị hủy vẫn từng được chốt, và cách này khớp card "Lịch hẹn" của dashboard/funnel.
- **`arrived`** — tập con của `booked` có `checked_in_at is not null`. Dùng mốc thay vì `status in ('checked_in','completed')` vì transition `checked_in → cancelled` (đến-không-làm) giữ nguyên `checked_in_at`; hoàn tác `checked_in → booked` mới xóa mốc.
- **`baseRevenue`** — Σ `service_ledgers.total_amount` (not null = đã báo giá) của sổ có `service_id` đó, `created_at` trong kỳ. Giống định nghĩa `revenue` của `/api/finance/revenue`, chỉ thêm chiều dịch vụ.
- **`upsalesRevenue`** — Σ `appointment_upsales.amount`, `created_at` trong kỳ, nhóm theo **`service_id` của chính upsale** (dịch vụ được bán thêm), KHÔNG theo dịch vụ gốc của lịch. Đây là điểm khác `/api/finance/revenue` (nơi upsales chỉ là 1 số tổng).
- **`orderCount`** — số sổ đã báo giá + số record upsale. Mỗi upsale là một lần bán dịch vụ đó nên phải tính là đơn; nếu không, dịch vụ chỉ được upsale (không có sổ nào) sẽ có doanh thu > 0 mà `orderCount = 0` → AOV chia 0.
- **`aov`** = `revenue / orderCount`, bằng 0 khi `orderCount = 0`.

## Kiến trúc

- Tính toán thuần trong `lib/financial.ts` (`calculateServiceStats`) — nhận 5 mảng row tối giản, dễ test, không đụng Supabase. Route chỉ lo auth / validate / fetch / phân trang.
- 5 query chạy `Promise.all`, mỗi query phân trang `PAGE_SIZE = 1_000` theo pattern `/api/finance/revenue` để không dính trần 1.000 row của PostgREST.
- Danh sách dịch vụ lấy toàn bộ bảng `services` (kể cả `is_active = false`, trả kèm `isActive`) — dịch vụ vừa tắt vẫn phải hiện số liệu lịch sử. Sort theo `revenue` desc rồi tên tiếng Việt.
- Gác `requireAdmin()` như `/api/finance/revenue` và `/api/sales/performance` vì trả số tiền.
- KHÔNG trả growth/kỳ trước: user chỉ yêu cầu 5 chỉ số; thêm khi UI cần (mỗi kỳ so sánh sẽ nhân đôi 5 query).

## Đánh đổi

- `data` theo `customers.created_at` còn `booked` theo `scheduled_at` → không phải phễu của cùng một nhóm khách; tỉ lệ `booked / data` chỉ đọc được ở mức xu hướng. Đây là lựa chọn của user (khớp dashboard hiện tại); muốn phễu chặt thì đổi sang cohort khách tạo trong kỳ.
- Lịch cũ chưa có dịch vụ (`appointment_services` rỗng) không thuộc dịch vụ nào → không xuất hiện trong bảng.
