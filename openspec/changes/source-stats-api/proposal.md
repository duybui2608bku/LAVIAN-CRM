# Proposal: source-stats-api

## Why

Trang báo cáo đã có phễu, lịch hẹn, tài chính, sales và dịch vụ — nhưng chưa trả lời được câu hỏi marketing cơ bản nhất: **nguồn nào ra data, nguồn nào ra tiền**. Dữ liệu đã có sẵn (`customers.source` + `enum_options` kind `source` kèm màu), chỉ thiếu chỗ tổng hợp. Ô nửa hàng còn trống cạnh bảng "Hiệu quả dịch vụ" là chỗ đặt 2 biểu đồ tròn.

## What Changes

- Thêm route mới `GET /api/customers/sources?from&to` (gác admin vì có số tiền): mỗi nguồn 1 dòng
  - `data` — số khách TẠO trong kỳ (giờ VN, chưa xóa mềm) mang nguồn đó;
  - `baseRevenue` — Σ `total_amount` sổ `service_ledgers` tạo trong kỳ, quy về nguồn của khách sở hữu sổ;
  - `upsalesRevenue` — Σ `appointment_upsales.amount` tạo trong kỳ, quy về nguồn của khách qua lịch hẹn;
  - `revenue` = tổng 2 số; kèm `label_vi/en/id` + `color` lấy từ `enum_options` để UI vẽ đúng màu nguồn.
- Trang báo cáo `/`: ô nửa hàng còn trống thành section **"Nguồn khách hàng"** với **2 biểu đồ tròn** (Data theo nguồn, Doanh thu theo nguồn) — donut SVG tự dựng, legend nhãn + giá trị + %, tooltip gốc `<title>`, tâm hiện tổng (tiền dùng bản rút gọn `Rp 6,3 jt`).
- KHÔNG đổi DB.

## Capabilities

### New Capabilities
- `source-stats-api`: API + biểu đồ tròn thống kê data và doanh thu (gồm upsales) theo nguồn khách hàng.

### Modified Capabilities

(không có)

## Impact

- Thêm `app/api/customers/sources/route.ts`.
- Sửa `lib/financial.ts` (+ `lib/financial.test.ts`), `lib/customers.ts` (nới type `optionLabel`), `lib/currency.ts` (thêm `formatRupiahCompact`), `components/dashboard/marketing-stats.tsx`, `messages/{vi,en,id}.json` (+5 key).
- Không migration, không thêm thư viện chart.
