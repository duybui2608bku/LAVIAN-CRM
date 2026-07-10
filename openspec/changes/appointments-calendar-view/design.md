# Design: Calendar view tuần/tháng cho /appointments

## Context

`/appointments` nạp toàn bộ lịch chưa xóa về client, lọc client-side (`matchesAppointmentFilters`), bảng nhóm theo trạng thái. Màu + icon trạng thái đã có ở `STATUS_META` (`status-tag.tsx`). Dialog sửa lịch (`AppointmentDialog`) dùng chung. Yêu cầu: thêm chế độ calendar tuần/tháng, card màu theo trạng thái, click mở dialog sửa.

## Goals / Non-Goals

**Goals:**
- Xem lịch hẹn dạng lưới tuần (giờ × 7 ngày) và tháng (ô ngày + chip), điều hướng trước/sau/hôm nay.
- Card màu trạng thái, click mở dialog sửa sẵn có; bộ lọc search/staff/service/status áp dụng chung.
- Thuần client, không dependency mới, không đổi DB.

**Non-Goals:**
- Kéo-thả dời lịch, resize thời lượng (dời lịch đã có popover ở bảng).
- Tạo lịch bằng click ô trống (nút "Đặt lịch" sẵn có; thêm sau nếu cần).
- Day-view calendar (tab "Trong ngày" dạng bảng đã phục vụ đúng ca này).
- Lịch chưa có ngày (`scheduled_at null`) — vẫn chỉ nằm ở tab "Chờ xếp lịch".

## Decisions

1. **Tự dựng lưới bằng CSS grid + Tailwind, KHÔNG thêm thư viện.**
   - Loại FullCalendar/react-big-calendar: nặng (~200KB+), theme khó khớp shadcn token, kéo theo localizer. Nhu cầu chỉ là hiển thị + click — ~250 dòng component tự viết đủ, khớp design token sẵn.
   - `date-fns` đã có trong repo → dùng cho tính tuần/tháng (`startOfWeek weekStartsOn:1`, `addDays`...), không tự viết đại số ngày.

2. **State chế độ xem trong `AppointmentsManager`:** `view: "table" | "week" | "month"` (useState, không URL param — đồng nhất tab/day hiện tại). UI: segmented toggle icon (List | Calendar) cạnh nút Tải lại; khi ở calendar hiện thêm segmented **Tuần/Tháng** + nút **‹ / Hôm nay / ›** và **ẩn** tab Trong ngày/Chờ xếp lịch + DatePicker + lọc status (search/staff/service giữ). Anchor date dùng chung state `day` sẵn có (đổi view không mất ngữ cảnh ngày đang xem).

3. **Component mới `components/appointments/appointments-calendar.tsx`** nhận `appointments` (đã qua filter search/staff/service — KHÔNG filter theo ngày), `view`, `anchor`, `onPick(a)`, `onPickDay(d)`. Nội bộ:
   - Gom lịch theo `localDay(scheduled_at)` (helper sẵn có), bỏ qua `scheduled_at null`.
   - **Tuần:** cột giờ trái + 7 cột ngày (T2–CN); dải giờ mặc định 08–20h, tự nới nếu có lịch ngoài dải. Card absolute: `top` theo giờ bắt đầu, `height` theo `duration_minutes` (min-height 1 dòng). Chồng giờ → chia lane bằng helper thuần `assignLanes` (greedy, testable).
   - **Tháng:** lưới 7×n tuần đủ phủ tháng; mỗi ô: số ngày + tối đa 3 chip + "+n" nếu dư. Click số ngày hoặc "+n" → `onPickDay` → set `day` + chuyển `view: "table"` (xem chi tiết ngày bằng bảng sẵn có — không dựng day-calendar riêng).
   - Hôm nay: highlight nền `bg-accent`/số ngày primary.

4. **Card màu theo trạng thái = pattern EnumTag:** export `STATUS_META` từ `status-tag.tsx`, card set CSS var `--tag` (nền `--tag/10`–`/20`, viền trái 3px màu gốc, chữ theo pattern dark của enum-tag). Không tạo bảng màu mới.

5. **Helper thuần vào `lib/appointments.ts`:** `assignLanes(list)` (xếp lane khi chồng giờ) + `groupByDay(list)` — test bằng `node --test` như helper hiện có. Tính tuần/tháng dùng date-fns ngay trong component (không test riêng phần gọi thư viện).

## Risks / Trade-offs

- [Nhiều lịch 1 ngày làm ô tháng chật] → chỉ 3 chip + "+n", click về bảng ngày.
- [Card tuần quá ngắn khi duration nhỏ] → min-height 20px, text truncate, title tooltip đầy đủ.
- [Chồng giờ nhiều lane làm card hẹp] → lane chia đều bề rộng, chấp nhận; salon hiếm khi >3 lịch trùng giờ 1 lúc.
- [Nạp toàn bộ lịch client-side] → như hiện trạng /appointments, đã ghi nhận từ change trước; giới hạn range server-side khi dữ liệu lớn.

## Open Questions

_(không — mọi quyết định đã chốt theo hướng tối giản)_
