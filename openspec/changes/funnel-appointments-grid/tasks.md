## 1. API

- [x] 1.1 Mở rộng `app/api/appointments/summary/route.ts`: thêm 3 query head-count `appointment_payments!inner` kind=deposit (selected / newCustomer / tomorrow), metric kỳ hiện tại trả thêm `deposited` / `notDeposited`

## 2. UI

- [x] 2.1 `marketing-stats.tsx`: fetch `/api/customers/funnel` + `/api/appointments/summary` trong cùng transition (helper `fetchApi` dùng chung với finance); `getMarketingStats` kỳ trước chỉ gọi khi `showSpend`
- [x] 2.2 Section phễu: pipeline 4 card nối `ChevronRight` (count, % so bước đầu qua prop `share` của MetricCard, badge growth), dòng tổng chuyển đổi; bỏ pie chart (xóa `CustomerPieChart`); giữ 2 card spend khi `showSpend`
- [x] 2.3 Section lịch hẹn: 3 card (trong ngày / ngày chọn label linh hoạt từ `period` server / ngày mai với nhãn "so với hôm nay") + `GrowthBadge` tách dùng chung + Deposit/No deposit; bỏ card Tổng lịch hẹn
- [x] 2.4 i18n vi/en/id: thêm funnelSection, totalConversion, newCustomerAppointments(+hint), appointmentsOn, vsToday; gỡ `totalAppointments` + `customerSection`

## 3. Kiểm chứng

- [x] 3.1 `npx tsc --noEmit` + eslint sạch
- [x] 3.2 Smoke test REST (secret key server-side): deposit head-count = 2/7 lịch, embed đôi `customers!inner`+`appointment_payments!inner` cũng trả 2 (không nhân bản row). CÒN THIẾU: happy path cần session admin (curl không session bị proxy 307 về login)
- [x] 3.3 Cập nhật `memory-bank/README.md`
