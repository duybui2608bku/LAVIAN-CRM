## ADDED Requirements

### Requirement: Chuẩn hoá lỗi tập trung
Hệ thống SHALL cung cấp một kiểu lỗi chuẩn hoá (`AppError`) và một hàm `normalizeError()` để gom lỗi từ nhiều nguồn (Axios, Supabase, Zod, Error thường) về cùng một dạng có `message` (thân thiện người dùng), `code`, và `status` tuỳ chọn.

#### Scenario: Chuẩn hoá lỗi Axios
- **WHEN** một request Axios thất bại với response lỗi
- **THEN** `normalizeError()` trả về `AppError` với `status` từ HTTP và `message` đọc được

#### Scenario: Chuẩn hoá lỗi không xác định
- **WHEN** một giá trị không phải Error được ném ra (ví dụ chuỗi hoặc `undefined`)
- **THEN** `normalizeError()` vẫn trả về `AppError` với thông điệp mặc định, không làm crash ứng dụng

### Requirement: Ranh giới lỗi hiển thị theo ngôn ngữ
Hệ thống SHALL có error boundary ở cấp route (`error.tsx`) và cấp gốc (`global-error.tsx`) hiển thị thông điệp lỗi và nút thử lại.

#### Scenario: Lỗi render trong một route
- **WHEN** một Server/Client Component ném lỗi lúc render
- **THEN** `error.tsx` gần nhất hiển thị fallback UI kèm nút thử lại (`unstable_retry`)

#### Scenario: Lỗi ở root layout
- **WHEN** lỗi xảy ra ở root layout
- **THEN** `global-error.tsx` render UI thay thế có thẻ `<html>`/`<body>` riêng

### Requirement: Trang 404
Hệ thống SHALL có trang `not-found` hiển thị khi truy cập đường dẫn không tồn tại hoặc khi gọi `notFound()`.

#### Scenario: Truy cập URL không tồn tại
- **WHEN** người dùng truy cập một đường dẫn không khớp route nào
- **THEN** hệ thống hiển thị trang 404 với nội dung theo ngôn ngữ hiện tại và liên kết về trang chủ
