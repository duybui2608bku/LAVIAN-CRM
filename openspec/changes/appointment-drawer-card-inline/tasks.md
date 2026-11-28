## 1. Thẻ liệu trình dùng chung

- [x] 1.1 `card-drawer.tsx`: tách `CardServices` (dòng DV, sửa tại chỗ khi `editable`), `CardBody` (Thanh toán + Lộ trình + Lịch sử), `CardActions` (Hoàn / Huỷ / In), `AddServiceDrawer`; `CardDrawer` dùng lại các phần này
- [x] 1.2 `CardPanel`: header (mã + trạng thái + Thêm dịch vụ khi mở + nút Chi tiết thẻ/Thu gọn, chevron xoay), DV + 3 số tiền, phần sổ xuống grid-rows 0fr→1fr + opacity 300ms, `motion-reduce`, `inert`, dựng lười từ lần mở đầu

## 2. Drawer lịch hẹn

- [x] 2.1 `AppointmentDrawer`: thay `CardSummary` + `onOpenCard` bằng `CardPanel` (`cardMe`), bọc `ConfigProvider componentDisabled={false}`
- [x] 2.2 `Form component={false}` (tránh form thu tiền lồng `<form>`), `FormDrawer push={false}`
- [x] 2.3 `FormDrawer`: prop `push`
- [x] 2.4 `AppointmentsManager`: truyền `cardMe` thay `onOpenCard` (cột Thẻ trên bảng vẫn mở `CardDrawer`)
- [x] 2.5 i18n vi/en: `cards.details`, `cards.collapse`; bỏ `appointments.openCard`

## 3. Kiểm tra

- [x] 3.1 `tsc` + `eslint` các file đã sửa
- [ ] 3.2 Xem thực tế trên trình duyệt (mở/thu gọn, thu tiền, tạo tour, thêm DV mở cạnh, in thẻ)
