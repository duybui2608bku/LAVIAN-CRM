# image-upload — delta: upload-image-third-party

## ADDED Requirements

### Requirement: Upload ảnh qua API bên thứ 3 (cfig.ibytecdn.org)

Hệ thống SHALL upload ảnh qua route handler `POST /api/upload`: nhận FormData `file` + `server` từ client, forward tới `POST https://cfig.ibytecdn.org/upload` dưới dạng FormData field `images[]` + `server`. KHÔNG set header thủ công (runtime tự gắn `multipart/form-data; boundary=...`), KHÔNG cần API key.

#### Scenario: Upload thành công
- **WHEN** upstream trả HTTP 2xx, `payload.success === true`, `results` không rỗng và `results[0].url` tồn tại
- **THEN** `/api/upload` trả `{ success: true, data: { url: results[0].url }, meta: { timestamp } }`, component gọi `onChange(data.url)`

#### Scenario: Request thiếu file
- **WHEN** FormData gửi lên không có field `file` hợp lệ
- **THEN** trả 400 với `{ success: false, error: { message: "Vui lòng chọn tệp ảnh." }, meta: { timestamp, path: "/api/upload" } }`

#### Scenario: Upstream fail
- **WHEN** upstream trả non-2xx, hoặc `success !== true`, hoặc `results` thiếu/rỗng, hoặc `results[0].url` không tồn tại
- **THEN** trả 502 với `error.message = "Upload ảnh thất bại."`, UI hiển thị qua toast

#### Scenario: Người chưa đăng nhập gọi /api/upload
- **WHEN** request không có session hợp lệ
- **THEN** proxy chặn (redirect /login), không forward tới upstream

### Requirement: ImageUpload giữ nguyên hợp đồng với form

Component `ImageUpload` SHALL giữ nguyên props `value/onChange/maxSizeMb/disabled/className/label`; validate phía client trước khi gửi: MIME bắt đầu `image/` và kích thước nhỏ hơn `maxSizeMb` (mặc định 10MB); nút X SHALL vẫn dọn best-effort ảnh Supabase cũ theo public URL (URL ngoài bucket tự bỏ qua).

#### Scenario: Thay avatar cũ (đang là URL Supabase)
- **WHEN** người dùng bấm X trên ảnh có URL thuộc bucket `images`
- **THEN** file cũ trên Supabase được xóa best-effort, `onChange(null)`

#### Scenario: Xóa ảnh URL bên thứ 3
- **WHEN** người dùng bấm X trên ảnh có URL CDN bên thứ 3
- **THEN** chỉ `onChange(null)` (không gọi xóa upstream — API không hỗ trợ)
