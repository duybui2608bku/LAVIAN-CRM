# source-stats-api — Delta Spec

## ADDED Requirements

### Requirement: API thống kê theo nguồn khách hàng
Hệ thống SHALL cung cấp `GET /api/customers/sources?from=YYYY-MM-DD&to=YYYY-MM-DD` (gác admin) trả về, với **mỗi nguồn có phát sinh trong kỳ** (quy đổi giờ VN qua `supaRange`):
- `data`: số khách `deleted_at is null`, `created_at` trong kỳ, mang nguồn đó;
- `baseRevenue`: Σ `total_amount` của sổ `service_ledgers` tạo trong kỳ thuộc khách mang nguồn đó (bỏ sổ chưa báo giá);
- `upsalesRevenue`: Σ `amount` của `appointment_upsales` tạo trong kỳ, quy về nguồn của khách qua lịch hẹn;
- `revenue` = `baseRevenue + upsalesRevenue`;
- `label_vi` / `label_en` / `label_id` / `color` lấy từ `enum_options` kind `source`.

Response SHALL kèm `totals { data, revenue }` và `period { from, to, timezone, start, endExclusive }`.

#### Scenario: Trả số liệu đúng theo kỳ
- **WHEN** admin gọi API cho kỳ mà nguồn Instagram có 11 khách mới, 3 sổ báo giá tổng 6.300.000 và 1 upsale 33.333
- **THEN** dòng Instagram trả `data=11`, `baseRevenue=6300000`, `upsalesRevenue=33333`, `revenue=6333333`, kèm `color` của option Instagram

#### Scenario: Tổng doanh thu khớp API tài chính
- **WHEN** so tổng `revenue` mọi nguồn với `revenue + upsalesRevenue` của `/api/finance/revenue` cùng kỳ
- **THEN** hai con số bằng nhau (cùng định nghĩa: sổ báo giá tạo trong kỳ + upsale tạo trong kỳ)

#### Scenario: Nguồn đã xoá khỏi danh mục
- **WHEN** khách mang nguồn không còn trong `enum_options`
- **THEN** vẫn có dòng cho nguồn đó, `label_vi` = giá trị thô, `color = null`

#### Scenario: Khách chưa gắn nguồn
- **WHEN** có khách `source is null` trong kỳ
- **THEN** trả 1 dòng gộp `source: null` (UI tự đặt nhãn "Chưa gắn nguồn")

#### Scenario: Nguồn không phát sinh không có dòng
- **WHEN** một option nguồn không có khách mới và không có tiền trong kỳ
- **THEN** API không trả dòng cho nguồn đó

#### Scenario: Chặn không phải admin
- **WHEN** request không có session admin
- **THEN** trả lỗi `{ error: { code, message } }` với status 401/403

#### Scenario: Khoảng ngày không hợp lệ
- **WHEN** `from`/`to` thiếu, sai định dạng, hoặc `from > to`
- **THEN** trả 400 `INVALID_DATE_RANGE`

#### Scenario: Không dính trần 1.000 row
- **WHEN** kỳ có hơn 1.000 khách, sổ hoặc upsale
- **THEN** API vẫn cộng đủ (query phân trang)

### Requirement: Biểu đồ tròn theo nguồn trên trang báo cáo
Trang báo cáo `/` SHALL hiển thị section "Nguồn khách hàng" chiếm **nửa hàng** (cạnh bảng Hiệu quả dịch vụ) gồm **2 biểu đồ tròn** lấy từ `GET /api/customers/sources` theo khoảng ngày đang chọn: "Data theo nguồn" và "Doanh thu theo nguồn".

#### Scenario: Màu theo nguồn, không theo thứ hạng
- **WHEN** đổi khoảng ngày làm thứ tự các nguồn thay đổi
- **THEN** mỗi nguồn giữ nguyên màu của nó (`enum_options.color`), không bị tô lại theo vị trí

#### Scenario: Nhận diện không chỉ bằng màu
- **WHEN** biểu đồ hiển thị
- **THEN** mỗi lát có mục legend kèm nhãn nguồn, giá trị và %; hover vào lát hiện tooltip nhãn + giá trị

#### Scenario: Kỳ không có dữ liệu
- **WHEN** API trả mảng rỗng
- **THEN** section hiện "Không có dữ liệu nguồn" thay vì biểu đồ trống

#### Scenario: Chỉ số bằng 0 ở một biểu đồ
- **WHEN** trong kỳ có data nhưng chưa phát sinh doanh thu
- **THEN** biểu đồ Data vẫn vẽ bình thường, biểu đồ Doanh thu hiện vòng xám + tâm "—" (không chia 0)
