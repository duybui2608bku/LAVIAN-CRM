## Why

Sales Management (`/appointments`): 2 cột Sales + Master chiếm chỗ, còn tên Telesales thì không thấy trên bảng. Sếp muốn 1 cột Nhân sự chung, gồm avatar + tên, tối đa 2 hàng, có cả Telesales.

## What Changes

- Bỏ 2 cột Sales, Master (inline select). Thêm 1 cột **Nhân sự** (`appointments.staffColumn`), chỉ xem: Telesales (`staff_id`) · Sales (`sales_id`) · Master (`technician_id`), mỗi người là avatar + tên.
- Xếp trên lưới 2 cột, nên 3 người tối đa 2 hàng. Người chưa gán thì bỏ qua, không ai thì hiện "—". Hover vào từng người thấy vai trò.
- Sales và Master giờ sửa trong drawer Sửa lịch hẹn (mục 3. Nhân sự). Telesales vẫn chỉ xem.

## Impact

- Sửa `components/appointments/appointments-manager.tsx` và `messages/{vi,en}.json`.
- Không có migration, API không đổi.
