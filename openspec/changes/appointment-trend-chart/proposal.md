## Why

Section "Lịch hẹn" trên trang báo cáo đang chiếm trọn 1 hàng cho 3 card, trong khi nửa hàng còn lại bỏ trống và dashboard chưa có bất kỳ biểu đồ theo thời gian nào — không nhìn được xu hướng ngày qua ngày. User yêu cầu: gọn section lịch hẹn lại còn 1/2 hàng, nửa còn lại là biểu đồ cột 7 ngày gần nhất với 3 chỉ số Data / Lịch hẹn / Khách đến.

## What Changes

- **API mới `GET /api/appointments/trend?to=YYYY-MM-DD`** (mặc định hôm nay giờ VN): trả 7 phần tử theo ngày VN, mỗi ngày `{ date, data, appointments, visited }` — `data` = khách hàng tạo trong ngày, `appointments` = lịch hẹn có `scheduled_at` trong ngày, `visited` = lịch hẹn có `checked_in_at` trong ngày. Gác **đăng nhập** như `/api/appointments/summary` (không có số tiền, RLS đã mở `customers`/`appointments` cho mọi user đăng nhập) → 3 card lịch hẹn và biểu đồ cùng nửa hàng đều chạy được với user thường.
- **Section "Lịch hẹn" thu gọn** còn 1/2 hàng (`xl:grid-cols-2`): 3 card giữ nguyên số liệu nhưng nén lại (padding/typo nhỏ hơn, hint chuyển thành `title`, deposit/no-deposit về 1 dòng).
- **Section "Xu hướng 7 ngày"** nằm nửa hàng còn lại: biểu đồ cột nhóm 3 series thuần CSS (không thêm thư viện chart), legend + tooltip có nhãn và số.
- i18n vi/en/id cho tiêu đề biểu đồ; nhãn series tái dùng key sẵn có (`serviceData`, `appointments`, `serviceArrived`).

## Capabilities

### New Capabilities
- `appointment-trend-api`: API thống kê 7 ngày gần nhất cho biểu đồ cột (Data / Lịch hẹn / Khách đến).
- `dashboard-trend-chart`: Bố cục 1/2 hàng cho lịch hẹn + biểu đồ cột 7 ngày trên trang báo cáo.

### Modified Capabilities

(không có — `dashboard-funnel-grid` chưa archive, phần bố cục mới viết ở capability riêng)

## Impact

- Thêm mới: `app/api/appointments/trend/route.ts`.
- Sửa: `components/dashboard/marketing-stats.tsx`, `messages/{vi,en,id}.json`.
- Không migration, không đổi API cũ, không thêm dependency.
