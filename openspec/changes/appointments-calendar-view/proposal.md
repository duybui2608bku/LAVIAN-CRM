# Proposal: Calendar view tuần/tháng cho trang Lịch hẹn

## Why

Trang `/appointments` hiện chỉ có bảng theo từng ngày — muốn nhìn tổng quan lịch cả tuần/tháng (giống Google Calendar) phải bấm đổi ngày từng lần. Calendar view từng bị hoãn (YAGNI) ở change `appointment-management`; giờ người dùng yêu cầu thật.

## What Changes

- Thêm **toggle chế độ xem** trên trang `/appointments`: icon bảng (mặc định, giữ nguyên UI hiện tại) ↔ icon calendar.
- Chế độ calendar có 2 kiểu: **Tuần** (lưới giờ × 7 ngày, card lịch hẹn đặt theo giờ bắt đầu + thời lượng) và **Tháng** (lưới ngày, chip lịch hẹn xếp dọc trong ô ngày).
- Card/chip lịch hẹn: tô **màu theo trạng thái** (tái dùng màu `STATUS_META`), hiện giờ + tên khách; bấm vào mở `AppointmentDialog` sửa lịch (dialog sẵn có).
- Điều hướng: nút Trước/Sau/Hôm nay đổi tuần hoặc tháng đang xem.
- Các bộ lọc hiện có (search, trạng thái, nhân viên, dịch vụ) vẫn áp dụng cho calendar view; tab "Chờ xếp lịch" không đổi (lịch chưa có ngày không lên calendar).
- **KHÔNG** đổi DB, không server action mới, không dependency mới — dữ liệu đã nạp toàn bộ về client sẵn.

## Capabilities

### New Capabilities

_(không có)_

### Modified Capabilities

- `appointments`: thêm requirement calendar view tuần/tháng (toggle từ bảng, card màu theo trạng thái, click mở dialog sửa, điều hướng tuần/tháng).

## Impact

- `components/appointments/appointments-manager.tsx` — toggle chế độ xem, render calendar.
- `components/appointments/appointments-calendar.tsx` (mới) — lưới tuần + tháng.
- `lib/appointments.ts` (+ test) — helper thuần tính khoảng tuần/tháng, gom lịch theo ngày.
- `messages/{vi,en,id}.json` — key i18n mới (chế độ xem, tuần/tháng, hôm nay...).
- Không đụng: DB/migration, actions, dialog, proxy, sidebar.
