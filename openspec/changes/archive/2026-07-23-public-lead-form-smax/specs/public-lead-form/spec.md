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
Khi submit hợp lệ, hệ thống SHALL tạo 1 dòng `customers` mới với `stage` = giai đoạn chọn trên form (select liệt kê enum_options kind `stage` đang active — đọc bằng admin client vì trang anonymous; mặc định `'new_lead'`, giá trị sai định dạng rơi về `'new_lead'`), `source` mặc định `'smax'` (hoặc giá trị `?source=` hợp lệ), `first_contact` = ngày hiện tại (Asia/Ho_Chi_Minh), `staff_id` = nhân viên khách chọn (nếu có), và ghi chú (nếu nhập) append vào `notes` với `by='Form SMAX'` — KHÔNG ghi note dấu vết "Từ SMAX"; sau đó hiển thị màn hình cảm ơn.

#### Scenario: Submit hợp lệ
- **WHEN** khách điền họ tên + SĐT hợp lệ rồi bấm Gửi
- **THEN** `customers` có dòng mới stage `new_lead`, source `smax`, và form hiện thông báo thành công

#### Scenario: Override nguồn qua query param
- **WHEN** form được mở với `?source=referral` và submit hợp lệ
- **THEN** khách hàng mới có `source='referral'`; giá trị sai định dạng thì dùng `'smax'`

#### Scenario: Chọn giai đoạn
- **WHEN** khách chọn giai đoạn "Đang tư vấn" rồi submit hợp lệ
- **THEN** dòng `customers` mới có `stage='consulting'`; không chọn gì thì `stage='new_lead'`

### Requirement: Validate đầu vào tại trust boundary
Server action SHALL từ chối submit thiếu/sai định dạng (họ tên rỗng hoặc >120 ký tự; SĐT không khớp 8–15 ký tự số/`+ ().-`; ghi chú >1000 ký tự) và trả lỗi hiển thị trên form, không ghi DB. Field honeypot ẩn có giá trị SHALL bị bỏ qua lặng lẽ (trả success giả, không insert).

#### Scenario: Thiếu SĐT
- **WHEN** khách bấm Gửi khi SĐT trống
- **THEN** form hiện lỗi validate, không có dòng customers mới

#### Scenario: Bot điền honeypot
- **WHEN** request gửi lên có field ẩn `website` khác rỗng
- **THEN** không insert DB nhưng vẫn trả về thành công

### Requirement: Chọn nhân viên tư vấn
Form SHALL có select "Nhân viên tư vấn" (không bắt buộc, xoá được) liệt kê profiles `status='active'` có tên (đọc server-side bằng admin client vì trang anonymous). Server action SHALL chỉ chấp nhận `staff_id` là uuid hoặc rỗng; uuid không tồn tại trong profiles bị DB (FK) từ chối.

#### Scenario: Khách chọn nhân viên
- **WHEN** khách chọn 1 nhân viên rồi submit hợp lệ
- **THEN** dòng `customers` mới có `staff_id` của nhân viên đó

#### Scenario: Không chọn
- **WHEN** khách bỏ trống select nhân viên
- **THEN** `staff_id` là null, submit vẫn thành công

### Requirement: Lưu metadata SMAX vào khách hàng
Khi submit từ form nhúng SMAX, hệ thống SHALL lưu thêm metadata từ event `__SM_FORM_CUSTOMER` gần nhất vào dòng `customers`: `source` = `customer.platform` (giá trị enum source đã đồng bộ với SMAX; thiếu/sai định dạng thì rơi về `?source=` rồi `'smax'`), `social_name` = `customer.name_original`, `picture` = `customer.picture` (null nếu không có), `tags` = mảng `customer.tags` (chỉ giữ các key id/name/alias/time), `thread` = object `thread` của event (chỉ giữ id/tid/message/link). Form mở ngoài iframe (không có event) SHALL hoạt động như cũ: các field metadata null/rỗng, source theo `?source=`/`'smax'`.

#### Scenario: Submit từ iframe SMAX
- **WHEN** SMAX gửi event có `customer.platform='instagram'`, `name_original='tiii'`, `picture`, 1 tag "Follow up" và `thread` rồi khách submit hợp lệ
- **THEN** dòng `customers` mới có `source='instagram'`, `social_name='tiii'`, `picture` là URL avatar, `tags` chứa tag Follow up, `thread` chứa `{id,tid,message,link}`

#### Scenario: Mở form trực tiếp (không nhúng)
- **WHEN** khách mở `/lead-form` trực tiếp và submit hợp lệ
- **THEN** `social_name`/`picture`/`thread` null, `tags` rỗng, `source` theo `?source=` hoặc `'smax'`

### Requirement: Tích hợp SMAX postMessage
Khi chạy trong iframe (`window.parent !== window`), form SHALL gửi `{name:'__SM_FORM_CUSTOMER', data:{integration_id}}` lên parent lúc mount (integration_id từ query param) và khi nhận event `__SM_FORM_CUSTOMER` SHALL prefill các ô tên/SĐT còn trống từ `customer.name`/`customer.phone`. Vì SMAX không tự bắn event khi đổi khách trong inbox, form SHALL poll gửi lại `__SM_FORM_CUSTOMER` mỗi ~3 giây (chỉ khi nhúng): event có `customer.id` KHÁC lần trước SHALL nạp lại ô tên/SĐT theo khách mới; id không đổi SHALL không đụng form (không đè thứ khách đang gõ). Nút "Gửi thông tin khác" trên màn hình cảm ơn SHALL prefill lại theo khách SMAX đang mở. Sau khi gửi thành công, màn hình cảm ơn SHALL có nút Đóng gửi `{name:'__SM_FORM_POPUP', action:'HIDE'}`.

#### Scenario: Prefill từ SMAX
- **WHEN** SMAX gửi event `__SM_FORM_CUSTOMER` với `customer.name = "Hoàng Đức"` khi ô tên đang trống
- **THEN** ô họ tên tự điền "Hoàng Đức"; ô khách đã gõ dở không bị đè

#### Scenario: Đổi khách trong SMAX
- **WHEN** nhân viên đang xem khách A rồi chuyển sang khách B trong SMAX (không thao tác gì trên form)
- **THEN** trong vòng ~3 giây ô tên/SĐT tự nạp lại theo khách B (id đổi); nếu vẫn là khách A thì form giữ nguyên thứ đang gõ

#### Scenario: Đóng popup sau khi gửi
- **WHEN** khách bấm nút Đóng trên màn hình cảm ơn trong iframe
- **THEN** form postMessage `__SM_FORM_POPUP` action `HIDE` lên parent

### Requirement: Theme và ngôn ngữ trên trang public
Trang `/lead-form` SHALL có nút chuyển theme và bộ chọn ngôn ngữ (tái dùng `ThemeToggle`/`LanguageSwitcher`). Với khách chưa có lựa chọn lưu trước đó, trang SHALL mặc định **light mode** và **tiếng Anh**; lựa chọn đã lưu (cookie `NEXT_LOCALE`, localStorage `theme`) SHALL được tôn trọng. Mặc định tiếng Anh SHALL không ảnh hưởng route khác (nơi khác vẫn mặc định `vi`).

#### Scenario: Khách mới mở form
- **WHEN** người chưa từng chọn ngôn ngữ/theme mở `/lead-form`
- **THEN** trang render tiếng Anh (`<html lang="en">`) và light mode, kể cả khi OS đang dark

#### Scenario: Khách đã chọn tiếng Việt
- **WHEN** trình duyệt có cookie `NEXT_LOCALE=vi` mở `/lead-form`
- **THEN** trang render tiếng Việt

#### Scenario: Không lan sang route khác
- **WHEN** người chưa có cookie mở `/login`
- **THEN** trang vẫn mặc định tiếng Việt

### Requirement: Seed nguồn SMAX
Migration SHALL thêm giá trị `('source','smax')` vào `enum_options` (label SMAX, icon, màu, sort_order 45) theo kiểu idempotent (`on conflict do nothing`), chạy tay trong Supabase SQL Editor.

#### Scenario: Chạy migration
- **WHEN** chạy `20260714090000_seed_source_smax.sql` (kể cả chạy lại)
- **THEN** `enum_options` có đúng 1 dòng kind `source` value `smax`, label admin đã sửa không bị đè
