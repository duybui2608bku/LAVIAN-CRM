## ADDED Requirements

### Requirement: Hỗ trợ 3 ngôn ngữ
Hệ thống SHALL hỗ trợ 3 locale: `en` (English), `vi` (Tiếng Việt), `id` (Bahasa Indonesia). Locale mặc định SHALL là `vi`.

#### Scenario: Locale mặc định khi chưa chọn
- **WHEN** người dùng truy cập lần đầu và chưa có cookie ngôn ngữ
- **THEN** hệ thống dùng locale mặc định `vi` và render nội dung tiếng Việt

#### Scenario: Locale không hợp lệ
- **WHEN** cookie ngôn ngữ chứa giá trị ngoài `en`/`vi`/`id`
- **THEN** hệ thống bỏ qua và dùng locale mặc định `vi`

### Requirement: Ghi nhớ ngôn ngữ qua cookie
Hệ thống SHALL lưu lựa chọn ngôn ngữ của người dùng vào cookie và giữ nguyên URL (không thêm tiền tố locale).

#### Scenario: Người dùng đổi ngôn ngữ
- **WHEN** người dùng chọn một ngôn ngữ trong bộ chuyển ngôn ngữ
- **THEN** hệ thống ghi giá trị locale vào cookie và tải lại nội dung theo ngôn ngữ mới mà không đổi đường dẫn URL

#### Scenario: Giữ ngôn ngữ giữa các lần truy cập
- **WHEN** người dùng đã chọn ngôn ngữ và quay lại sau đó
- **THEN** hệ thống đọc cookie và render đúng ngôn ngữ đã chọn

### Requirement: Nạp bản dịch trên server
Hệ thống SHALL nạp bản dịch theo locale trên server (Server Component) để không tăng kích thước bundle client bằng toàn bộ file dịch.

#### Scenario: Render nội dung đã dịch
- **WHEN** một trang hoặc component đọc một khoá dịch (translation key)
- **THEN** hệ thống trả về chuỗi đã dịch theo locale hiện tại

#### Scenario: Thuộc tính lang của thẻ html
- **WHEN** trang được render
- **THEN** thẻ `<html>` SHALL có thuộc tính `lang` khớp với locale hiện tại
