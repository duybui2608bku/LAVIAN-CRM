# Tasks: appointments-calendar-view

## 1. Helper thuần + test

- [x] 1.1 `lib/appointments.ts`: thêm `groupByDay(list)` (Map ngày local → lịch sắp theo giờ, bỏ `scheduled_at null`) và `assignLanes(list)` (xếp lane greedy cho lịch chồng giờ, trả `{lane, lanes}` mỗi lịch)
- [x] 1.2 `lib/appointments.test.ts`: test groupByDay (bỏ null, sắp theo giờ) + assignLanes (không chồng → 1 lane; chồng → 2 lane; case xen kẽ) — `node --test` PASS

## 2. Component calendar

- [x] 2.1 Export `STATUS_META` từ `components/appointments/status-tag.tsx`
- [x] 2.2 Tạo `components/appointments/appointments-calendar.tsx`: lưới Tuần (cột giờ 08–20h tự nới, 7 cột T2–CN, card absolute theo giờ/thời lượng/lane, màu `--tag` pattern enum-tag, click → `onPick`) + lưới Tháng (ô ngày, ≤3 chip + "+n", click ngày/"+n" → `onPickDay`), highlight hôm nay

## 3. Nối vào AppointmentsManager

- [x] 3.1 State `view` + segmented toggle icon bảng/calendar cạnh nút Tải lại; ở calendar: segmented Tuần/Tháng + nút ‹ / Hôm nay / › + nhãn khoảng thời gian; ẩn tab + DatePicker + lọc status khi view ≠ table
- [x] 3.2 Render calendar với list đã lọc (search/staff/service, KHÔNG lọc ngày); `onPick` → `setTarget(a)`; `onPickDay` → set `day` + về view table

## 4. i18n + kiểm chứng

- [x] 4.1 `messages/{vi,en,id}.json`: key mới namespace `appointments` (viewTable, viewCalendar, week, month, today, prev, next, more {count})
- [x] 4.2 `node --test lib/appointments.test.ts` PASS; `tsc --noEmit` sạch; `next build` PASS; cập nhật `memory-bank/README.md`
