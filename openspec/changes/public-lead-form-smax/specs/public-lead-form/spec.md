# public-lead-form

## ADDED Requirements

### Requirement: Truy cập form public
Hệ thống SHALL phục vụ trang `/lead-form` cho mọi người (không cần đăng nhập), kể cả khi nhúng iframe, và KHÔNG redirect người dùng đã đăng nhập ra khỏi trang.

#### Scenario: Khách vãng lai mở form
- **WHEN** người chưa đăng nhập mở `/lead-form`
- **THEN** form hiển thị bình thường, không bị redirect về `/login`

#### Scenario: Nhân viên đã đăng nhập mở form
- **WHEN** user đã đăng nhập mở `/lead-form`
- **THEN** form hiển thị bình thường (không bị đá về `/` như /login, /banned)

### Requirement: Tạo khách hàng từ form
Khi submit hợp lệ, hệ thống SHALL tạo 1 dòng `customers` mới với `stage='new_lead'`, `source` mặc định `'smax'` (hoặc giá trị `?source=` hợp lệ), `first_contact` = ngày hiện tại (Asia/Ho_Chi_Minh), và ghi chú (nếu nhập) + dấu vết khách SMAX (nếu có) append vào `notes` với `by='Form SMAX'`; sau đó hiển thị màn hình cảm ơn.

#### Scenario: Submit hợp lệ
- **WHEN** khách điền họ tên + SĐT hợp lệ rồi bấm Gửi
- **THEN** `customers` có dòng mới stage `new_lead`, source `smax`, và form hiện thông báo thành công

#### Scenario: Override nguồn qua query param
- **WHEN** form được mở với `?source=referral` và submit hợp lệ
- **THEN** khách hàng mới có `source='referral'`; giá trị sai định dạng thì dùng `'smax'`

### Requirement: Validate đầu vào tại trust boundary
Server action SHALL từ chối submit thiếu/sai định dạng (họ tên rỗng hoặc >120 ký tự; SĐT không khớp 8–15 ký tự số/`+ ().-`; ghi chú >1000 ký tự) và trả lỗi hiển thị trên form, không ghi DB. Field honeypot ẩn có giá trị SHALL bị bỏ qua lặng lẽ (trả success giả, không insert).

#### Scenario: Thiếu SĐT
- **WHEN** khách bấm Gửi khi SĐT trống
- **THEN** form hiện lỗi validate, không có dòng customers mới

#### Scenario: Bot điền honeypot
- **WHEN** request gửi lên có field ẩn `website` khác rỗng
- **THEN** không insert DB nhưng vẫn trả về thành công

### Requirement: Tích hợp SMAX postMessage
Khi chạy trong iframe (`window.parent !== window`), form SHALL gửi `{name:'__SM_FORM_CUSTOMER', data:{integration_id}}` lên parent lúc mount (integration_id từ query param) và khi nhận event `__SM_FORM_CUSTOMER` SHALL prefill các ô tên/SĐT còn trống từ `customer.name`/`customer.phone`. Sau khi gửi thành công, màn hình cảm ơn SHALL có nút Đóng gửi `{name:'__SM_FORM_POPUP', action:'HIDE'}`.

#### Scenario: Prefill từ SMAX
- **WHEN** SMAX gửi event `__SM_FORM_CUSTOMER` với `customer.name = "Hoàng Đức"` khi ô tên đang trống
- **THEN** ô họ tên tự điền "Hoàng Đức"; ô khách đã gõ dở không bị đè

#### Scenario: Đóng popup sau khi gửi
- **WHEN** khách bấm nút Đóng trên màn hình cảm ơn trong iframe
- **THEN** form postMessage `__SM_FORM_POPUP` action `HIDE` lên parent

### Requirement: Seed nguồn SMAX
Migration SHALL thêm giá trị `('source','smax')` vào `enum_options` (label SMAX, icon, màu, sort_order 45) theo kiểu idempotent (`on conflict do nothing`), chạy tay trong Supabase SQL Editor.

#### Scenario: Chạy migration
- **WHEN** chạy `20260714090000_seed_source_smax.sql` (kể cả chạy lại)
- **THEN** `enum_options` có đúng 1 dòng kind `source` value `smax`, label admin đã sửa không bị đè
