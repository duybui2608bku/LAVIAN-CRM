## ADDED Requirements

### Requirement: Đăng nhập bằng email và mật khẩu
Hệ thống SHALL cho phép người dùng đăng nhập bằng email + mật khẩu thông qua Supabase Auth, và lưu session vào cookie SSR để Server Component đọc được. Hệ thống SHALL KHÔNG cung cấp luồng tự đăng ký.

#### Scenario: Đăng nhập thành công
- **WHEN** người dùng nhập đúng email + mật khẩu của một tài khoản `status=active` tại `/login`
- **THEN** hệ thống tạo session, ghi cookie và điều hướng về trang chủ ứng dụng `/`

#### Scenario: Sai thông tin đăng nhập
- **WHEN** người dùng nhập sai email hoặc mật khẩu
- **THEN** hệ thống hiển thị thông báo lỗi chung ("Email hoặc mật khẩu không đúng") và không tạo session

#### Scenario: Không có trang đăng ký
- **WHEN** người dùng cố truy cập bất kỳ đường dẫn đăng ký công khai nào
- **THEN** hệ thống không tồn tại route đó (chỉ admin tạo tài khoản)

### Requirement: Đăng xuất
Hệ thống SHALL cho phép người dùng đã đăng nhập đăng xuất, xoá session và cookie.

#### Scenario: Đăng xuất
- **WHEN** người dùng bấm "Đăng xuất"
- **THEN** hệ thống huỷ session, xoá cookie và điều hướng về `/login`

### Requirement: Bảo vệ route khi chưa đăng nhập
Proxy SHALL chặn mọi request chưa đăng nhập vào các route trong shell ứng dụng và điều hướng tới `/login`. Các route công khai (`/login`, `/banned`, tài nguyên tĩnh) SHALL truy cập được khi chưa đăng nhập.

#### Scenario: Truy cập route được bảo vệ khi chưa đăng nhập
- **WHEN** một request không có session hợp lệ truy cập một route trong `app/(app)/`
- **THEN** proxy điều hướng (redirect) tới `/login`

#### Scenario: Đã đăng nhập vào lại trang login
- **WHEN** người dùng đã đăng nhập truy cập `/login`
- **THEN** proxy điều hướng về trang chủ `/`

### Requirement: Chặn tài khoản bị khoá
Proxy SHALL điều hướng người dùng có `status=banned` sang trang `/banned` cho mọi route ứng dụng, kể cả khi họ còn session hợp lệ.

#### Scenario: Người dùng bị khoá truy cập ứng dụng
- **WHEN** người dùng có session hợp lệ nhưng `profiles.status=banned` truy cập bất kỳ route ứng dụng nào
- **THEN** proxy điều hướng tới `/banned`

#### Scenario: Trang bị khoá cho phép đăng xuất
- **WHEN** người dùng bị khoá đang ở `/banned`
- **THEN** trang hiển thị thông báo tài khoản bị khoá và một nút đăng xuất hoạt động được

### Requirement: Giới hạn route admin theo vai trò
Proxy SHALL chỉ cho phép người dùng có `role=admin` truy cập các route quản trị (ví dụ `/users`). Người dùng `role=user` truy cập route quản trị SHALL bị điều hướng về trang chủ.

#### Scenario: User thường truy cập trang quản lý user
- **WHEN** người dùng `role=user` truy cập `/users`
- **THEN** proxy điều hướng về `/` (không cho vào)

#### Scenario: Admin truy cập trang quản lý user
- **WHEN** người dùng `role=admin` truy cập `/users`
- **THEN** proxy cho phép request đi tiếp
