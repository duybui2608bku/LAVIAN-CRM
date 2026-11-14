## Why

Phễu và biểu đồ xu hướng ở `/reports/telesales` đang vẽ tay (thanh div), chưa giống mẫu (phễu hình thang, biểu đồ đường + vùng). Dòng mô tả khoảng ngày "09/11 – 14/11 · so với 03/11 – 08/11" thừa; ô thiếu dữ liệu dùng "—".

## What Changes

- Cài `chart.js` + `react-chartjs-2` + `chartjs-chart-funnel`.
- Phễu: hình thang 4 tầng (Tin nhắn → Booking → Đã xác nhận → Khách đến), độ rộng thu đều theo tầng, nhãn + số + % so với Tin nhắn in trên tầng.
- Xu hướng: biểu đồ đường + vùng, 2 series Booking mới / Khách đến theo ngày (`DayStat.newBookings`).
- Bỏ dòng mô tả khoảng ngày + kỳ so sánh dưới tiêu đề.
- Không có dữ liệu → "-".

## Impact

- `components/reports/telesales-charts.tsx` (mới), `components/reports/telesales-report-view.tsx`, `lib/telesales-report.ts` (+ test), `messages/{vi,en}.json`, `package.json`.
- Không đổi DB.
