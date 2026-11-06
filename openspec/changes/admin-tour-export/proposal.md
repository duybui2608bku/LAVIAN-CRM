## Why

Admin cần xem và chốt tiền tour của cả đội kỹ thuật viên mỗi tháng: thấy theo từng người, có file Excel để đối soát và phiếu tour (tiếng Anh) để KTV ký nhận.

## What Changes

- Admin ở `/tour`: select KTV có thêm "Tất cả kỹ thuật viên" (mặc định).
- Bảng thêm cột **Nhân viên** (KTV) khi admin xem.
- **Gom nhóm theo nhân viên**: mỗi KTV là một dòng nhóm (số lịch, tổng bill, tổng tour), mở ra xem chi tiết. Có công tắc bật/tắt.
- Nút **Xuất Excel**: file `.xlsx` của tháng đang xem, gom theo KTV, có dòng tổng mỗi KTV + tổng cộng.
- Nút **Phiếu tour (PDF)**: phiếu tiếng Anh mỗi KTV một trang (bảng lịch, tổng tour, chỗ ký), qua hộp thoại in của trình duyệt → "Save as PDF".
- Tháng chuyển lên URL (`?month=YYYY-MM`), lọc tháng phía server (±1 ngày đệm, lọc chính xác ở client theo múi giờ trình duyệt) — tránh giới hạn 1000 dòng của Supabase khi xem cả đội.
- Non-admin giữ nguyên (chỉ xem của mình, không có nút xuất).

## Capabilities

### Modified Capabilities

- `technician-tour-page`: thêm chế độ xem cả đội, gom nhóm, xuất Excel, phiếu tour PDF cho admin.

## Impact

- Không đổi DB.
- Thêm dependency `exceljs` (import động lúc bấm xuất).
- Sửa `app/(app)/tour/page.tsx`, `components/tour/tour-view.tsx`; thêm `components/tour/tour-export.ts`, `components/tour/tour-slips.tsx`; CSS in trong `app/globals.css`; i18n vi/en.
