# Design: source-stats-api

## Quy về nguồn như thế nào

Nguồn là thuộc tính của **khách hàng** (`customers.source`), nên mọi con số đều quy về khách:

| Chỉ số | Đường quy chiếu | Mốc thời gian |
|---|---|---|
| `data` | `customers.source` | `customers.created_at` trong kỳ, `deleted_at is null` |
| `baseRevenue` | `service_ledgers` → `customers.source` (embed `customers!inner(source)`) | `service_ledgers.created_at` trong kỳ |
| `upsalesRevenue` | `appointment_upsales` → `appointments` → `customers.source` (embed lồng 2 tầng) | `appointment_upsales.created_at` trong kỳ |

Định nghĩa doanh thu **khớp y nguyên** `/api/finance/revenue` và `/api/services/stats` (sổ đã báo giá tạo trong kỳ + upsale tạo trong kỳ), chỉ đổi chiều nhóm. Đã đối chiếu trên dữ liệu thật: tổng doanh thu theo nguồn = tổng theo dịch vụ = 6.333.333 cho kỳ 01→24/07.

**Không lọc khách xóa mềm ở phần doanh thu** (chỉ lọc ở `data`) để tổng doanh thu luôn bằng con số tài chính chung — xóa mềm 1 khách không được làm bốc hơi tiền đã ghi nhận.

## Nhãn và màu

- Nhãn + màu lấy từ `enum_options` kind `source` (kể cả option đã tắt — khách cũ vẫn cần nhãn).
- Nguồn có trong `customers` nhưng option đã bị xoá → giữ **giá trị thô** làm nhãn, `color = null` (UI dùng `--muted-foreground`).
- Khách chưa gắn nguồn → gom vào 1 dòng `source: null`, UI đặt nhãn bằng i18n `unknownSource`.
- Chỉ trả dòng **có phát sinh** (`data > 0` hoặc có tiền) — biểu đồ tròn không cần lát 0%.

## Biểu đồ

- **Không thêm thư viện chart.** 2 donut = SVG `stroke-dasharray` trên `<circle>`, ~30 dòng. Recharts/Chart.js sẽ kéo theo hàng trăm KB cho đúng 2 hình tròn tĩnh.
- Màu **đi theo entity** (nguồn), không theo thứ hạng — đổi bộ lọc ngày không đổi màu lát; Instagram luôn hồng như tag trong bảng /customers.
- Legend luôn có **nhãn + giá trị + %** nên không nhận diện bằng màu đơn thuần; mỗi lát có `<title>` = tooltip gốc của trình duyệt (không JS).
- Khe hở 2 đơn vị giữa 2 lát để 2 màu cạnh nhau không dính.
- Tâm donut hiện tổng; tiền dùng `formatRupiahCompact` ("Rp 6,3 jt") vì số đầy đủ tràn khỏi lỗ donut 128px.
- Đã chạy palette validator của skill dataviz trên 7 màu nguồn: CVD separation PASS (ΔE 8.8), normal-vision PASS (19.7); FAIL duy nhất là `#6b7280` của nguồn "Khác" (chroma thấp — cố ý, đó là màu xám cho nhóm khác), WARN contrast của `#f97316` được bù bằng legend có chữ.

## Đánh đổi

- Doanh thu quy về nguồn của khách tại **thời điểm truy vấn**: đổi nguồn của khách sẽ dời cả doanh thu lịch sử sang nguồn mới (không snapshot nguồn lúc phát sinh tiền). Chấp nhận được vì nguồn hiếm khi sửa; muốn bất biến thì phải thêm cột snapshot khi tạo sổ.
- API không trả kỳ trước / growth — 2 biểu đồ tròn không hiển thị tăng trưởng.
