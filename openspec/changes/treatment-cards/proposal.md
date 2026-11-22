## Why

Doanh thu chưa rõ: tiền cọc gắn khách, Giá trị DV / Thu thêm gắn từng lịch hẹn (0/31 lịch có nhập), tour có Hoá đơn riêng — không có chỗ nào ghi "khách đã mua gì, bao nhiêu tiền, đã trả bao nhiêu". Sếp chốt bán **thẻ liệu trình** (như phần mềm spa: gói dịch vụ + số buổi + thanh toán/công nợ + hoàn dịch vụ) làm nguồn tiền duy nhất, tour gắn vào thẻ để có lịch sử lộ trình.

## What Changes

- **Thẻ liệu trình** = khách + 1..n dịch vụ (từ bảng giá `services`) + mã riêng `TLT00001`.
  - Mỗi dòng dịch vụ: giá bán (mặc định giá bảng giá, sửa được = giảm giá), **số buổi** (mặc định 1), trạng thái hoạt động / đã hoàn (+ số tiền hoàn).
  - Giá trị thẻ = Σ giá bán − Σ tiền hoàn. Đã thu = cọc trừ vào thẻ + Σ thanh toán. Công nợ = Giá trị − Đã thu (âm = phải hoàn khách).
  - Cọc của khách trừ **1 lần**: thẻ mới chỉ trừ phần cọc chưa dùng ở thẻ khác (chưa huỷ), tối đa bằng giá trị thẻ. Tính trong RPC `create_treatment_card` (1 transaction, khoá dòng khách).
  - Thêm dịch vụ, hoàn dịch vụ (gợi ý = giá × buổi chưa làm / tổng buổi), thu tiền (tiền mặt / chuyển khoản / thẻ, âm = hoàn tiền), huỷ thẻ (admin).
  - Tạo thẻ → khách chuyển stage `purchase` (Đã mua).
- **Sales Management** (`/appointments`): cột DV chi tiết → cột **Thẻ liệu trình**: lịch đã có thẻ hiện mã thẻ (bấm mở thẻ); lịch khách đã đến (arrived/in_progress/done) chưa có thẻ hiện icon giỏ hàng → drawer chọn dịch vụ → tạo thẻ. Cột Tài chính + dải số liệu đọc từ thẻ (Deposit không còn cộng trùng). Drawer Sửa lịch hẹn bỏ ô Giá trị DV / Thu thêm / DV chi tiết, thay bằng tóm tắt thẻ.
- **Menu Thẻ liệu trình** (`/cards`, quyền mới `cards.view/edit/delete`): bảng thẻ + drawer chi tiết (Dịch vụ x/y buổi, Thanh toán, **Lộ trình tour**), nút **Tạo tour** chọn dịch vụ trong thẻ (mỗi dịch vụ 1 tour, Lần tự điền = số tour + 1, Hoá đơn = giá bán).
- **Tour**: cột `tours.card_item_id`; bỏ nút Tạo tour ở `/tour` (tour chỉ tạo từ thẻ). Nhận tour / ảnh / Tỷ lệ % / xác nhận giữ nguyên.

## Impact

- Migration `supabase/migrations/20261122100000_treatment_cards.sql` — chạy TRƯỚC khi deploy.
- Mới: `lib/cards{,.test}.ts`, `types/card.ts`, `app/(app)/cards/{page,actions}.ts(x)`, `components/cards/*`.
- Sửa: `lib/permissions.ts`, `components/layout/app-shell.tsx`, `app/(app)/appointments/page.tsx`, `components/appointments/{appointments-manager,appointment-drawer}.tsx`, `lib/appointments.ts`, `components/tour/{tour-view,tour-drawer}.tsx`, `app/(app)/tour/*`, `types/tour.ts`, `messages/{vi,en}.json`.
- Cột `clinic_appointments.bill_amount/paid_amount/service_ids` giữ trong DB (không còn UI nhập).
