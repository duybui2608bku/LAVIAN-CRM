## Why

Ghi chú Sales của lịch hẹn hiện là 1 ô text (`clinic_appointments.sales_note`). Không biết ai ghi, ghi lúc nào, ghi đè lên nhau. Sếp muốn ghi chú Sales giống timeline "Toàn bộ lịch sử khách hàng": mỗi ghi chú có **người ghi, tiêu đề (không bắt buộc), thời gian, nội dung**.

## What Changes

- Cột mới `clinic_appointments.sales_notes jsonb` (mảng, mặc định `[]`). Mỗi phần tử: `{id, title, text, at, by, by_id}`. Server ghi `at`/`by`/`by_id`, không tin client.
- Chuyển nội dung `sales_note` cũ thành ghi chú đầu tiên (không tiêu đề, không người ghi, thời gian = `updated_at`). Cột `sales_note` giữ lại để rollback, code thôi dùng.
- **Drawer Ghi chú Sales** (`SalesNotesDrawer`):
  - Ô soạn ở trên cùng: chip tiêu đề gợi ý (Tư vấn, Nhu cầu, Kỹ thuật, Thanh toán, Chăm sóc). Bấm chip để điền tiêu đề, hoặc tự gõ; bỏ trống cũng được. Nội dung bắt buộc, Ctrl/⌘+Enter để lưu nhanh.
  - Timeline mới nhất ở trên: `dd/MM/YYYY · HH:mm` → **Tiêu đề** → `Người ghi · nội dung`.
  - Người ghi hoặc admin được xoá ghi chú của mình (có hỏi xác nhận). Không sửa (lịch sử giữ nguyên).
- Mở drawer từ: cột mới **Note Sales** trên bảng Sales Management (ghi chú gần nhất + `+N`), và mục 4 của drawer Sửa lịch hẹn (ô textarea thay bằng 2 ghi chú gần nhất + nút mở drawer).
- Quyền thêm: `appointments.edit` (như sửa lịch).

## Impact

- Migration `supabase/migrations/20261120090000_appointment_sales_notes.sql` (chạy trước khi deploy).
- `app/(app)/appointments/{actions.ts,page.tsx}`, `components/appointments/{sales-notes-drawer,appointment-drawer,appointments-manager}.tsx`, `types/appointment.ts`, `lib/appointments.ts`, `messages/{vi,en}.json`.
- Trigger log không theo dõi `sales_notes` (bản thân ghi chú đã có người ghi + thời gian).
