# Tasks: drawer-forms-booking-prefill

## 1. Drawer khách hàng

- [x] 1.1 `CustomerDialog` (customers-manager.tsx): Dialog → Sheet phải `w-full sm:max-w-xl`, thân form cuộn, SheetFooter flex-row dính đáy; giữ nguyên field/RHF

## 2. Drawer + prefill đặt lịch

- [x] 2.1 Nới type `CustomerRef` thêm optional `source`, `staff_id`, `service_ids`
- [x] 2.2 `AppointmentDialog`: Dialog → Sheet (layout như 1.1)
- [x] 2.3 Prefill tạo mới: initial values ưu tiên editing → customerLock; `setValue` source/service_ids/staff_id khi đổi khách trong select (chỉ khi !editing); mở rộng filter serviceOpts bao id đang gắn của customerLock
- [x] 2.4 `/appointments/page.tsx`: query customers thêm `source, staff_id, customer_services(service_id)` → map `service_ids`

## 3. Kiểm chứng

- [x] 3.1 `tsc --noEmit` sạch + `next build` PASS
- [x] 3.2 `openspec validate drawer-forms-booking-prefill` PASS; cập nhật memory-bank
