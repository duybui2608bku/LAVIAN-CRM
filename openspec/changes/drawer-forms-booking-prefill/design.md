# Design: Form drawer bên phải + prefill thông tin khách khi đặt lịch

## Context

- `components/ui/sheet.tsx` đã có sẵn (shadcn, dùng cho sidebar mobile) — Radix Dialog với side + animation, default `side="right"`, width `w-3/4 sm:max-w-sm`, có nút X đóng.
- 2 form cần chuyển: `CustomerDialog` (nội bộ `customers-manager.tsx`) và `AppointmentDialog` (`components/appointments/appointment-dialog.tsx`, dùng chung 2 trang). Cả 2 đang là `Dialog` `sm:max-w-xl max-h-[90vh] overflow-y-auto`, form 2 cột.
- `bookingFor` ở /customers đã là full `Customer` (có `source`, `staff_id`, `service_ids`) truyền vào prop `customerLock: CustomerRef` — structurally compatible, chỉ cần nới type.
- /appointments query customers chỉ `id, full_name, phone`.

## Goals / Non-Goals

**Goals:**
- 2 form thành drawer phải, full-height, thân cuộn, footer dính đáy; không đổi field/validation/submit.
- Tạo lịch hẹn mới: form khởi tạo/đồng bộ Nguồn + Dịch vụ + Nhân viên theo khách được chọn.

**Non-Goals:**
- Không đụng dialog nhỏ (lịch sử ghi chú, lịch sử lịch hẹn, AlertDialog xóa) — dialog giữa màn hình vẫn hợp cho nội dung đọc/xác nhận ngắn.
- Không sửa multi-select dịch vụ (đã có), không đổi DB/actions, không thêm i18n key.

## Decisions

1. **Dùng Sheet có sẵn, không cài gì thêm.** Override width `w-full sm:max-w-xl` (default `sm:max-w-sm` quá hẹp cho form 2 cột; mobile full-width thay vì `w-3/4`).
2. **Layout drawer:** `SheetContent` thêm `gap-0`; `SheetHeader` giữ p-4 mặc định; `<form>` = `flex min-h-0 flex-1 flex-col`, thân field `flex-1 overflow-y-auto px-4 pb-4 space-y-3`, footer = `SheetFooter` override `flex-row justify-end border-t` (mặc định flex-col). Full-height nên bỏ `max-h-[90vh]`.
3. **Prefill CHỈ khi tạo mới** (editing giữ nguyên dữ liệu lịch):
   - Initial `values`: `source`/`service_ids`/`staff_id` ưu tiên `editing` → `customerLock` → rỗng.
   - Đổi khách trong select: `setValue` 3 trường trong `onValueChange` của Controller `customer_id` (chỉ khi `!editing`). Chọn setValue thay vì đưa khách vào `values` (values reset toàn form → mất số tiền/ghi chú user đang gõ).
   - `service_ids` prefill lọc theo option đang hiển thị (`serviceOpts`) để không submit id vô hình; riêng `customerLock`/`editing` thì mở rộng filter `serviceOpts` bao luôn id đang gắn (pattern hiện có với editing).
4. **Mỗi field 1 hàng (follow-up):** bỏ `grid-cols-2` trong cả 2 form (`grid gap-3` 1 cột) — drawer hẹp, 1 cột dễ quét mắt; width `sm:max-w-xl` giữ nguyên.
5. **`CustomerRef` nới thêm optional `source?`, `staff_id?`, `service_ids?`** — /customers truyền full `Customer` tự khớp; /appointments select thêm `source, staff_id, customer_services(service_id)` rồi map `service_ids` (pattern map nested sẵn có ở page).

## Risks / Trade-offs

- [Đổi khách sau khi đã sửa tay Nguồn/Dịch vụ → bị ghi đè theo khách mới] → chấp nhận: đổi khách nghĩa là đặt lịch cho người khác, dữ liệu theo khách mới là đúng kỳ vọng.
- [Sheet full-height làm form ngắn trông trống phần đáy] → footer `mt-auto` dính đáy, thân cuộn độc lập — chấp nhận, đồng nhất 2 form.
- [Radix cảnh báo thiếu `Description` trên console dev] → hành vi cũ của Dialog cũng vậy, giữ nguyên.
