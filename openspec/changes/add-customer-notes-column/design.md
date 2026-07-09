# Design: add-customer-notes-column

## Context

`customers.notes` là jsonb `[{text, at}]`, chỉ xem/thêm được trong dialog Sửa (client tự append `{text, at: new Date()}` rồi gửi cả mảng). Không lưu người ghi. Trang `/customers` đã có Popover, Dialog, `getCurrentProfile()` sẵn dùng.

## Goals / Non-Goals

**Goals:**
- Thao tác note ngay trên bảng: thêm nhanh (Plus → Popover) + xem lịch sử (Info → Dialog).
- Note có người ghi (`by`), do server stamp — client không tự đặt `at`/`by` nữa.

**Non-Goals:**
- Không đổi schema DB (jsonb chứa được `by`), không migration.
- Không sửa/xóa từng note, không phân trang lịch sử (YAGNI).
- Không khóa đồng thời (2 người note cùng lúc trên **cùng 1 khách** có thể ghi đè nhau — đã ghi nhận từ trước, hiếm; nâng cấp: RPC jsonb append phía DB).

## Decisions

1. **`by` = tên hiển thị (string), không phải user id.** Lịch sử là snapshot — tên tại thời điểm ghi; không join, không vỡ khi profile bị xóa. Alternative (lưu id + resolve): thêm join/lookup mọi chỗ hiển thị, không đáng.
2. **Server Action mới `addCustomerNote(id, text)`** cho popover: đọc `notes` hiện tại từ DB, append `{text, at, by}`, update. Không nhận mảng từ client → không ghi đè lịch sử bằng dữ liệu client cũ (cửa sổ race hẹp hơn).
3. **Dialog tạo/sửa gửi `CustomerInput.note` (text mới, optional)** thay vì client append. `clean()` trong actions append note đã stamp vào `input.notes` (create: mảng rỗng + note đầu; update: lịch sử từ `editing.notes`). Một chỗ stamp duy nhất (helper chung với `addCustomerNote`).
4. **UI cột Ghi chú:** 2 nút icon ghost nhỏ — Plus (Popover: textarea + nút Lưu, disable khi rỗng/pending) và Info (Dialog: tiêu đề "Lịch sử ghi chú - {tên}", danh sách **mới nhất trước**, mỗi mục: badge thời gian `toLocaleString()` + tên người ghi + text; note cũ thiếu `by` → "—"). Info disabled khi chưa có note.
5. **Note cũ `{text, at}` vẫn hợp lệ** — `by` optional trong type, UI fallback. Không backfill.

## Risks / Trade-offs

- [Race update dialog vs popover] dialog gửi `notes` snapshot từ lúc mở → note thêm bằng popover trong lúc dialog mở có thể bị đè khi bấm Lưu dialog. Mitigation: chấp nhận (đã là hành vi hiện tại của notes); nâng cấp RPC append nếu thành vấn đề thật.
- [Tên user đổi] note giữ tên cũ — chấp nhận, đúng tính chất "nhật ký".
