## ADDED Requirements

### Requirement: Mô hình hồ sơ người dùng
Hệ thống SHALL lưu metadata người dùng ở bảng `public.profiles` ánh xạ 1-1 với `auth.users` (khoá chính `id` tham chiếu `auth.users.id`, xoá theo cascade). Bảng SHALL gồm `email`, `user_name`, `avatar_url`, `role` (`admin` | `user`, mặc định `user`), `status` (`active` | `banned`, mặc định `active`), `created_at`. Hệ thống SHALL KHÔNG lưu mật khẩu trong `profiles` — mật khẩu do `auth.users` quản lý.

#### Scenario: Tự tạo hồ sơ khi có tài khoản mới
- **WHEN** một bản ghi mới được thêm vào `auth.users`
- **THEN** một dòng `profiles` tương ứng được tạo tự động (qua trigger) với `role=user`, `status=active`

#### Scenario: Không có cột mật khẩu
- **WHEN** kiểm tra cấu trúc bảng `profiles`
- **THEN** bảng không chứa cột lưu mật khẩu ở bất kỳ dạng nào

### Requirement: Admin tạo người dùng
Hệ thống SHALL cho phép admin tạo người dùng mới bằng email, mật khẩu, tên và (tuỳ chọn) avatar_url + role. Thao tác SHALL dùng Supabase Admin API chạy phía server (secret key không lộ ra client), đặt `email_confirm=true` để tài khoản dùng được ngay.

#### Scenario: Tạo user hợp lệ
- **WHEN** admin gửi form tạo user với email chưa tồn tại + mật khẩu hợp lệ
- **THEN** hệ thống tạo tài khoản trong `auth.users`, dòng `profiles` được điền `user_name`/`avatar_url`/`role`, và user xuất hiện trong danh sách

#### Scenario: Email trùng
- **WHEN** admin tạo user với email đã tồn tại
- **THEN** hệ thống báo lỗi và không tạo tài khoản trùng

#### Scenario: Người không phải admin gọi tạo user
- **WHEN** một request không có `role=admin` gọi Server Action tạo user
- **THEN** hệ thống từ chối thao tác

### Requirement: Cấm và bỏ cấm người dùng
Hệ thống SHALL cho phép admin đổi `status` của người dùng giữa `active` và `banned`.

#### Scenario: Cấm người dùng
- **WHEN** admin bấm "Cấm" trên một user `active`
- **THEN** `profiles.status` của user đó chuyển thành `banned` và lần truy cập kế tiếp của họ bị proxy đưa sang `/banned`

#### Scenario: Bỏ cấm người dùng
- **WHEN** admin bấm "Bỏ cấm" trên một user `banned`
- **THEN** `profiles.status` chuyển thành `active` và user đăng nhập/sử dụng lại được

### Requirement: Admin đặt lại mật khẩu
Hệ thống SHALL cho phép admin đặt lại mật khẩu của một người dùng nhanh chóng qua Admin API (không cần email).

#### Scenario: Đặt lại mật khẩu
- **WHEN** admin nhập mật khẩu mới cho một user và xác nhận
- **THEN** mật khẩu trong `auth.users` được cập nhật và user đăng nhập được bằng mật khẩu mới

### Requirement: Danh sách và lọc tìm người dùng
Hệ thống SHALL hiển thị cho admin danh sách người dùng (email, tên, role, status, ngày tạo) và cho phép lọc tìm theo `user_name` và email.

#### Scenario: Xem danh sách
- **WHEN** admin mở trang `/users`
- **THEN** hệ thống hiển thị danh sách người dùng kèm role và status

#### Scenario: Lọc theo từ khoá
- **WHEN** admin nhập một từ khoá vào ô tìm kiếm
- **THEN** danh sách chỉ còn các user có `user_name` hoặc email khớp từ khoá (không phân biệt hoa thường)

### Requirement: Bảo vệ dữ liệu bằng RLS
Bảng `profiles` SHALL bật Row Level Security: người dùng chỉ đọc được hồ sơ của chính mình; admin đọc/sửa được mọi hồ sơ. Thao tác ghi của admin (tạo/cấm/đặt lại mật khẩu) SHALL đi qua Server Action dùng service_role (bypass RLS).

#### Scenario: User đọc hồ sơ người khác
- **WHEN** một client đăng nhập với `role=user` truy vấn `profiles` của user khác
- **THEN** RLS chỉ trả về hồ sơ của chính họ

#### Scenario: Admin đọc toàn bộ
- **WHEN** một client đăng nhập với `role=admin` truy vấn `profiles`
- **THEN** RLS cho phép đọc mọi hồ sơ
