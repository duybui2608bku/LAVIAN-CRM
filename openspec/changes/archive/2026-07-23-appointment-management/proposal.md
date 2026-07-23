# Proposal: appointment-management

## Why

Workflow lịch hẹn của Lavian đang chạy bằng Excel nhiều sheet rời (booking, lịch hẹn theo ngày, cọc chưa có ngày, liệu trình tái hẹn, report ngày) — không có thực thể lịch hẹn trong CRM. `customers.stage = booked` chỉ phản ánh góc nhìn sales, không đủ để vận hành: ngày giờ, dời lịch, check-in, no-show, số tiền nội bộ (Price/DP/Paid/Sisa).

## What Changes

- Thêm 3 bảng mới: `appointments` (lịch hẹn, tiền nội bộ, soft-delete), `appointment_services` (bảng nối nhiều dịch vụ/lịch — copy pattern `customer_services`), `appointment_status_history` (audit đổi trạng thái, ghi bằng trigger).
- Trang mới `/appointments`: danh sách theo ngày (mặc định hôm nay), lọc trạng thái/nhân viên/dịch vụ, tab "Chờ xếp lịch" (`scheduled_at is null` — thay sheet DP CUS), action nhanh check-in / hoàn tất / no-show / hủy / dời lịch, dòng tổng doanh thu ngày, CTA + dialog tạo/sửa lịch hẹn.
- `/customers`: action "Đặt lịch" mở dialog tạo lịch hẹn cho khách + dialog xem lịch sử lịch hẹn của khách.
- Đồng bộ `customer.stage` chỉ đi TIẾN (so `sort_order`) khi tạo lịch/cọc/check-in.
- Không: đa chi nhánh, cổng thanh toán, reminder tự động, tách bảng payment từng đợt (phase 2 nếu cần).

## Capabilities

### New Capabilities
- `appointments`: quản lý vòng đời lịch hẹn của khách hàng — tạo/sửa/hủy, trạng thái, dịch vụ đi kèm, số tiền nội bộ, lịch sử trạng thái, màn hình vận hành theo ngày.

### Modified Capabilities
<!-- không có — customers chỉ thêm điểm vào (entry point) tạo lịch, không đổi requirement hiện có -->

## Impact

- **DB:** migration mới `supabase/migrations/` (3 bảng + index + RLS + grant + trigger history, reuse `set_updated_at()`).
- **Code:** `types/appointment.ts`, `app/(app)/appointments/{page,actions}.tsx`, `components/appointments/appointments-manager.tsx`; sửa `components/customers/customers-manager.tsx` (nút Đặt lịch), `components/layout/app-sidebar.tsx`, `messages/{vi,en,id}.json`.
- **Không đổi:** auth/RLS model hiện có (authenticated toàn quyền, giống customers); `proxy.ts` không cần gác thêm (mọi user dùng được /appointments).
