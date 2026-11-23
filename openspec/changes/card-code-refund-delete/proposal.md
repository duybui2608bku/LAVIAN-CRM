## Why

- Mã thẻ `TLT00001` là viết tắt tiếng Việt (Thẻ Liệu Trình) — nhân viên Indonesia đọc không hiểu. Mã nên nói ngay thẻ bán **dịch vụ chính** gì: `ALIS0001`, `BIBIR0002`.
- "Hoàn dịch vụ" từng dòng rắc rối (giá trị thẻ bị trừ lẻ, DV vẫn nằm trong thẻ). Thực tế: bán nhầm / khách đổi ý 1 DV → **xoá DV** (có nhật ký); khách bỏ liệu trình → **hoàn cả thẻ**.
- Sửa số buổi phải mở popover — chậm. Nhấp đúp vào "x/y buổi" là sửa luôn.

## What Changes

- **Mã thẻ** = tiền tố dịch vụ chính + số thứ tự chung (≥ 4 chữ số). DV chính = dòng tạo tour có giá cao nhất; nhóm xoá cũ quy về vùng (Laser → ALIS, Lips Treatment → BIBIR, Eyeliner Treatment → EYELINER), nhóm khác = tên nhóm viết hoa. Mã đặt 1 lần lúc tạo thẻ, không đổi khi thêm / xoá DV. Thẻ cũ `TLT000nn` đổi sang mã mới giữ nguyên số.
- **Xoá DV** (thay nút Hoàn DV): chỉ khi DV chưa có tour thật nào (còn hiệu lực), thẻ còn ≥ 1 DV khác. Xoá kèm tour dự kiến / tour đã xoá mềm của DV. Nhật ký thẻ ghi "Xoá DV · giá · buổi".
- **Hoàn thẻ**: nhập số tiền hoàn khách (≤ đã thu = cọc trừ + thanh toán), phương thức, lý do → thẻ trạng thái **Đã hoàn**: Giá trị thẻ = Đã thu sau hoàn (công nợ 0), khoá mọi thao tác (thu tiền, thêm / xoá DV, sửa buổi, tạo tour), xoá tour dự kiến, không vào Đến hạn. Báo cáo doanh thu trừ tiền hoàn vào ngày hoàn.
- **Sửa số buổi**: nhấp đúp vào "Đã dùng x/y buổi" → ô số tại chỗ, Enter / rời ô = lưu, Esc = huỷ. Bỏ popover.
- DV đã hoàn trước đây vẫn hiện (gạch ngang) — chỉ không tạo hoàn DV mới nữa.

## Impact

- DB: `supabase/migrations/20261123160000_card_code_refund_delete.sql` (cột hoàn thẻ, mã thẻ, RPC `refund_treatment_card` / `delete_treatment_card_item`, guard chặn thẻ đã hoàn, `journey_due_source`).
- Code: `lib/cards.ts`, `lib/roadmap-sync.ts`, `types/card.ts`, `app/(app)/cards/actions.ts`, `app/(app)/reports/actions.ts`, `app/(app)/customers/customer-360-actions.ts`, `components/cards/*`, `messages/{vi,en}.json`.
