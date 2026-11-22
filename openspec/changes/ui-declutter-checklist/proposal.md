## Why

User: "quá lạm dụng tag, chỗ nào cũng tag, components không dùng chung, flow khó hiểu khó dùng, thừa text như subtitle". 4 agent audit toàn bộ UI, đối chiếu checklist.design (Data Table, Badge, Filtering items, Single Item Detail, Drawer):

- **Tag tràn lan (~50 chỗ)**: ngày tạo, ngày hẹn, ngày nhắc, số WhatsApp (màu băm theo số → vô nghĩa), mã thẻ, tên dịch vụ, số buổi, loại tour, nhãn timeline, vai trò user… đều là Tag màu. Một dòng `/customers` có tới 5 tag; xanh dương mang ~5 nghĩa khác nhau; "Đổi lịch" chỗ xanh chỗ cam. Checklist Badge: chỉ dùng cho **trạng thái chuẩn** hoặc **số đếm**, màu nhất quán, luôn kèm chữ.
- **Không dùng chung**: `DASH` định nghĩa 5 lần, ô "tìm nhân viên → avatar + tên / —" chép 12 lần, option chọn nhân viên 10 lần, ô tìm kiếm 9 lần, nút xoá lọc 4 lần, tiêu đề mục 5 kiểu ở báo cáo + ~22 heading drawer 3 kiểu, `Intl.NumberFormat` IDR 4 lần, `MoneyInput` nằm trong 1 drawer.
- **Text thừa**: subtitle trang Đến hạn, gợi ý dưới tiêu đề drawer, mục đánh số "1. Khách hàng…", hint dưới card số liệu, icon (i) tooltip trên mọi card Telesales, mục "đang phát triển", tab "Sắp ra mắt"…
- **Lỗi**: (1) Điện thoại không vào được 5 trang con của "Khách hàng" (tab dưới chỉ lấy link cha, sheet Menu bỏ qua). (2) Ô chọn Sales/Master gõ tìm không ra ai (label là ReactNode, lọc theo `label`). (3) Drawer chỉ xem vẫn hiện "Huỷ" + "Lưu".

## What Changes

**Giai đoạn 1 (change này) — dọn giao diện, không đổi nghiệp vụ / dữ liệu / server action:**

- **1 kiểu trạng thái duy nhất — `StatusDot`** (chấm màu + chữ, antd `Badge color text`): thay `EnumTag` và mọi `<Tag color>` trạng thái. **Không còn Tag** cho ngày, số, mã, tên, SĐT, loại, vai trò — chữ thường; quá hạn = chữ đỏ. Badge chỉ còn cho **số đếm** trên icon.
- Màu "Đổi lịch" thống nhất (`purple`) giữa Xác nhận đặt lịch và Trạng thái.
- **Component dùng chung mới / gom lại** (`components/common/`): `cells.tsx` (`DASH`, `StatusDot`, `DateTimeCell`), `staffLabel(s?)` trả `DASH` khi trống + `staffOptions` (chuyển từ appointments-manager, tìm được theo tên), `filter-controls.tsx` (`SearchInput`, `ClearFilters`), `section.tsx` (`Section` — tiêu đề mục dùng cho báo cáo + drawer), `money-input.tsx` (chuyển `MoneyInput`), `formatIdr` ở `lib/currency.ts`, `FormDrawer` không truyền `onSubmit` = drawer chỉ xem (không nút Huỷ/Lưu).
- **Bỏ text thừa**: subtitle, hint, tooltip (i) giải thích hiển nhiên, mục placeholder "đang cập nhật", số thứ tự trong tiêu đề mục. Giữ: thông báo lỗi validate và gợi ý chặn nhập sai (nhập số âm khi hoàn tiền, link Google Docs phải chia sẻ công khai).
- **Xoá code chết**: `theme-toggle.tsx`, `icon-picker.tsx`, `LanguageSwitcher` (giữ `useSwitchLocale`), `TimePicker`, `appointment-photos.tsx`, `enum-tag.tsx`.
- Sửa 3 lỗi ở trên.

**Giai đoạn 2 (đề xuất, chờ sếp duyệt — KHÔNG làm trong change này)**: rút ngắn luồng Bán thẻ → Tạo tour; gộp 3 bề mặt chi tiết khách (360°, drawer thông tin, drawer lịch sử lịch hẹn) về 360°; thu tiền từ Popover → Modal Thu/Hoàn; gom bộ lọc ít dùng vào nút "Bộ lọc"; tổ chức lại menu (đổi tên trang cần sếp chốt lại — tên hiện tại sếp đã chốt 2026-11-20).

## Impact

- Sửa: hầu hết `components/**` hiển thị bảng/drawer, `app/globals.css`, `messages/{vi,en}.json` (xoá key thừa).
- **Không** migration DB, **không** thêm dependency, **không** đổi server action, **không** đổi tên trang.
