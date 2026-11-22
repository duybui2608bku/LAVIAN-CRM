## Why

Phản biện Thẻ liệu trình (2026-11-22, 5 agent) tìm ra lỗ hổng tiền và lỗi tính Đến hạn; sếp chốt quy tắc hoa hồng và người gọi khách:

- Công Master = giá DV trong thẻ (`tours.bill_amount`) × **Làm mới 7%, Dặm 3% (mọi lần), Laser/Plasma 0%**; mực không tính.
- Hoa hồng Sales = **5% tiền thực thu** của thẻ (cọc trừ vào thẻ + các lần thu, theo ngày thu; hoàn tiền trừ ngược), tính cho người tạo thẻ.
- **Telesales** gọi khách đến hạn (không phải Sales). Mốc 20 ngày = kiểm tra sau laser/plasma mày-môi đủ điều kiện phun mới chưa.
- Chưa làm: bảo hành / dặm tặng theo mực, chính sách hoàn tiền.

Hoa hồng dựa trên `created_by`, `paid_at`, `bill_amount`, Loại tour — hiện Sales sửa được qua REST (RLS `for all`), nên phải bịt lỗ cùng lúc.

## What Changes

**C — Bịt lỗ tiền (migration `20261122150000_card_controls_commission.sql`)**
- Thẻ: không insert trực tiếp (chỉ RPC `create_treatment_card`, chuyển `security definer` + kiểm `cards.edit`); chỉ admin update và chỉ cột huỷ; không bỏ huỷ.
- Dòng DV: chỉ update `sessions`, `refund_*`; không xoá; DV đã hoàn không sửa lại (trừ admin).
- Thanh toán: chỉ insert (`created_by` = người đăng nhập, `paid_at` = now với người không phải admin), không sửa; xoá chỉ admin; thẻ đã huỷ không thu.
- Tour: tạo chỉ khi có `cards.edit` + gắn thẻ; trigger chặn gắn sai thẻ / khách / DV, thẻ huỷ, DV đã hoàn; người không phải admin không đổi `bill_amount`, `card_item_id`, khách/DV của tour thẻ.
- Nhật ký `card_audit` (trigger, chỉ admin đọc): mọi thay đổi 3 bảng thẻ + cột tiền/Loại/KTV của tour.
- RPC: cọc trừ vào thẻ ≤ giá trị thẻ.
- App: huỷ thẻ bị chặn khi đã có thu tiền; tạo tour vượt số buổi chỉ admin.

**A — Hoa hồng**
- `services.tourable` (mực, phí Master/Grandmaster, Serum = false): không tạo tour, không tính buổi / hoàn thành / Đến hạn. Bảng giá có ô "Tạo tour".
- Trang Tour: cột + tổng **Công Master** (`tourCommission`), Excel + phiếu tour có cột Công.
- Báo cáo: bảng **Hoa hồng Sales** theo kỳ (tiền thực thu × 5%).

**B — Đến hạn cho Telesales**
- `journeyDue` tính theo **vùng** (mày: alis + laser; môi: bibir + lips_treatment; mí: eyeliner + eyeliner_treatment) — laser vùng này không che dặm vùng khác; bỏ qua DV không tạo tour.
- Trang mới **Khách hàng → Đến hạn liệu trình** (`/customers/journey`, quyền `customers.view`): tính ở server (Telesales không có quyền thẻ/tour), không trả tiền; phụ trách = Telesales của khách; khách đã có lịch hẹn sắp tới → "Đã hẹn", ẩn khỏi "Cần gọi"; nút mở chat SMAX / WhatsApp.
- Bỏ tab Đến hạn ở `/cards`.

## Impact

- Migration chạy **trước** khi deploy (code select `services.tourable`).
- Sửa: `lib/cards.ts(+test)`, `lib/tours.ts(+test)`, `lib/reports.ts`, `types/{card,service}.ts`, `app/(app)/cards/{actions,data}.ts`, `app/(app)/reports/actions.ts`, `components/cards/*`, `components/tour/*`, `components/reports/reports-view.tsx`, `components/services/services-manager.tsx`, `components/layout/app-shell.tsx`, `messages/{vi,en}.json`.
- Mới: `app/(app)/customers/journey/page.tsx`.
