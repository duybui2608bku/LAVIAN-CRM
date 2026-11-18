## Dữ liệu SMAX dùng để ghép

- Khách IG: `customer.phone`, `customer.phones[].value` (SMAX tự nhận khi khách gõ số).
- Khách WA: `customer.whatsappweb.id` = `<số>@s.whatsapp.net` (nhóm `@g.us` bỏ qua).
- Chuẩn hoá: chỉ giữ chữ số, `0…` → `62…`.

## Luồng

```
action ─┬─ fetchInboxThreads(created) ─┐
        ├─ fetchInboxThreads(active)  ─┼─> fetchIgByPhone: + IG tạo 30 ngày trước `from`
        │                              │     → quét tin nhắn IG có tag chuyển đổi mà thiếu số
        │                              │     → Map<SĐT, hội thoại IG>
        └──────────────── build*(…, igByPhone) ── byCustomer(threads, igByPhone)
```

`byCustomer(threads, igByPhone)`:
1. Như cũ: mỗi `customer.id` giữ 1 hội thoại (nhiều tag hơn).
2. Hội thoại WA có số trong `igByPhone` → gom vào nhóm của khách IG đó; hội thoại IG ấy nằm ngoài tập (vd chỉ có ở 30 ngày lùi) thì vẫn thêm vào nhóm.
3. Nhóm > 1 → gộp: lấy phần xuất hiện sớm nhất làm gốc (kênh, page, `instagram.ad_id`), `tag_aliases` hợp, `customer.tags` nối, `created_at`/`customer.created_at` sớm nhất, `last_message_at` muộn nhất.

Mọi phép đếm (khách mới, trạng thái, Booking, Re-engaged, Follow up, KH tiềm năng) chạy trên kết quả này nên tự đếm 1 lần. Lọc "khách mới" chuyển ra sau bước gộp (để người có phần IG cũ không thành khách mới).

## Quyết định

- **Không ghép ngược WA cũ → IG mới bằng cách tải WA lùi** (WA ~100 hội thoại/ngày, tốn): chỉ ghép khi cả 2 nằm trong dữ liệu đã tải; đo 6/69 cặp WA trước — khi đó kênh vẫn đúng là WA.
- **2 nhân viên (IG + WA) → tính cho cả 2**, tổng vẫn 1 — giữ quy tắc sẵn có của bảng theo Telesales.
- **Quét tin nhắn best-effort:** lỗi từng hội thoại bỏ qua, không làm hỏng báo cáo; tối đa 8 luồng.
