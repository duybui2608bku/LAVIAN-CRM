# authentication

## ADDED Requirements

### Requirement: Ghi nhớ đăng nhập
Form `/login` SHALL có checkbox "Ghi nhớ đăng nhập" (mặc định tick). Khi submit với checkbox tick, hệ thống SHALL lưu email + mật khẩu vào `localStorage` (key `lavian-login`) và lần mở `/login` sau SHALL prefill sẵn 2 ô từ giá trị đã lưu. Submit với checkbox bỏ tick SHALL xoá giá trị đã lưu.

#### Scenario: Đăng nhập có ghi nhớ
- **WHEN** user đăng nhập với checkbox "Ghi nhớ đăng nhập" đang tick
- **THEN** lần mở `/login` tiếp theo, ô email + mật khẩu đã điền sẵn

#### Scenario: Bỏ ghi nhớ
- **WHEN** user từng ghi nhớ, sau đó đăng nhập lại với checkbox bỏ tick
- **THEN** thông tin đã lưu bị xoá, lần mở `/login` sau form trống
