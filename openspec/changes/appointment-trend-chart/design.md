## Context

Dashboard đã có 6 API thống kê cùng khuôn (`from`/`to` ngày VN → `supaRange` → count/aggregate). Cần thêm số liệu **theo từng ngày** cho 7 ngày gần nhất — dạng dữ liệu đầu tiên bị chia nhóm theo ngày trong dự án.

## Quyết định

### 1. Gom theo ngày bằng 21 head-count thay vì kéo row về gom trong JS

- `Promise.all` 7 ngày × 3 chỉ số, mỗi cái là `select("id", { count: "exact", head: true })` + `supaRange(day, day)`.
- Lý do: PostgREST trả tối đa 1.000 row/request — nếu kéo row về gom thì phải thêm vòng phân trang (đã copy-paste ở 3 route khác) và vẫn chuyển vài nghìn row chỉ để đếm. Head-count không truyền row, không dính trần, và tái dùng đúng `supaRange` đã kiểm chứng nên không phát sinh code quy đổi timezone mới.
- Trần đã biết: 21 request/lần gọi. Nếu sau này cần 30–90 ngày thì chuyển sang RPC `group by date_trunc` — ghi trong comment `ponytail:` tại route.

### 2. Định nghĩa "Khách đến" = lịch hẹn có `checked_in_at` trong ngày

- Card phễu "Đã đến" đang dùng `customers.stage = 'visited'` lọc theo `customers.created_at` — đó là góc nhìn **cohort khách tạo trong kỳ**, không phải "hôm đó có bao nhiêu khách tới".
- Biểu đồ theo ngày cần góc nhìn **sự kiện xảy ra trong ngày**, và nó phải so được trực tiếp với cột "Lịch hẹn" cùng ngày → dùng `appointments.checked_in_at`. Check-in cũng chính là hành động set `stage = 'visited'` (`app/(app)/appointments/actions.ts`), nên 2 con số cùng nguồn sự thật, chỉ khác trục thời gian.

### 3. Biểu đồ cột thuần CSS

- 21 cột, không tương tác ngoài tooltip → không kéo thêm thư viện chart (dự án hiện không có, donut nguồn cũng tự vẽ SVG).
- Chiều cao cột = `value / max × 100%`, cột 0 vẫn vẽ vạch 2px để thấy "có ngày, không có số".
- Không dựa vào màu đơn thuần: mỗi cột có `title` + `aria-label` kèm nhãn series, ngày và số.

### 4. Gác đăng nhập, không gác admin

Các API có số tiền (finance, sales, services, sources) và funnel (kèm dữ liệu SMAX) đang gác `requireAdmin`. API này chỉ trả **số đếm** trên 2 bảng mà RLS đã mở cho mọi user đăng nhập (`customers_all using(true)`), nên gác admin chỉ chặn được route chứ không chặn dữ liệu — mà lại làm biểu đồ vỡ 403 ngay cạnh 3 card lịch hẹn vẫn chạy (`/api/appointments/summary` chỉ gác đăng nhập). Chốt: gác đăng nhập, cùng mức với section bên cạnh.

### 5. `to` bám theo bộ lọc ngày

Biểu đồ luôn là 7 ngày kết thúc ở `range.to` của DateRangePicker (mặc định hôm nay VN) — chọn kỳ quá khứ thì biểu đồ đi theo, không lệch ngữ cảnh với phần còn lại của trang.
