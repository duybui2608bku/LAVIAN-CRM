## Why

Sếp không muốn bấm "Mở thẻ" trong drawer lịch hẹn lại mở thêm 1 drawer thẻ chồng lên (2 lớp drawer, mất ngữ cảnh lịch hẹn). Muốn chi tiết thẻ **sổ xuống ngay dưới** khung thẻ, có animation mượt.

## What Changes

- Khung "Thẻ liệu trình" trong `AppointmentDrawer` thành **panel sổ xuống** (`CardPanel`):
  - Header: mã thẻ + trạng thái + nút "Chi tiết thẻ ⌄" / "Thu gọn ⌃" (chevron xoay, `aria-expanded`). Khi mở + có quyền sửa: thêm nút "Thêm dịch vụ" ở header.
  - Danh sách dịch vụ + dải 3 số tiền giữ nguyên khi thu gọn; khi mở, dòng dịch vụ sửa được tại chỗ (số buổi, xoá DV, kết quả laser) như drawer thẻ.
  - Phần sổ xuống (CSS grid `0fr → 1fr` + mờ dần, 250ms; `motion-reduce` tắt animation; `inert` khi thu gọn): ghi chú thẻ, Thanh toán (form thu tiền), Lộ trình tour (+ Tạo tour), Lịch sử, hàng nút Hoàn thẻ / Huỷ thẻ / In thẻ.
  - Chỉ render phần chi tiết sau lần mở đầu (nhẹ khi mở drawer), giữ lại sau đó để thu gọn vẫn mượt.
- `CardDrawer` (mở từ cột Thẻ trên bảng, trang Thẻ) giữ nguyên hành vi; tách phần dùng chung (`CardServices`, `CardBody`, `CardActions`, `AddServiceDrawer`) để 2 nơi dùng cùng 1 code.
- Form lịch hẹn dùng `component={false}` (không còn `<form>` bao ngoài → form thu tiền không bị lồng form); khung thẻ bọc `ConfigProvider componentDisabled={false}` để quyền sửa thẻ theo `cards.edit`, không theo quyền sửa lịch.
- `FormDrawer` thêm prop `push` (tắt đẩy drawer cha khi mở drawer con — "Thêm dịch vụ" mở cạnh drawer lịch hẹn).

## Impact

- Sửa: `components/cards/card-drawer.tsx`, `components/appointments/appointment-drawer.tsx`, `components/appointments/appointments-manager.tsx`, `components/common/form-drawer.tsx`, `messages/{vi,en,id}.json`.
- **Không** migration DB, **không** query / server action mới.
