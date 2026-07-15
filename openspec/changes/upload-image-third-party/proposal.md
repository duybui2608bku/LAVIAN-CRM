# Proposal: upload-image-third-party

## Why

Ảnh trong CRM đang upload vào Supabase Storage (bucket `images`). Yêu cầu mới: upload ảnh qua API bên thứ 3 để lấy link ảnh public, không lưu file trên Supabase nữa. Upstream chốt là **cfig.ibytecdn.org** (không cần API key) — thay phương án upanhnhanh.com ban đầu (cần `X-API-Key`, origin chết HTTP 522 lúc triển khai).

## What Changes

- Route handler `POST /api/upload` (server) nhận FormData `file` + `server` từ client, forward tới `https://cfig.ibytecdn.org/upload` (FormData field `images[]` + `server`; không set header thủ công, không API key).
- Thành công khi: upstream trả 2xx, `payload.success === true`, `results` không rỗng và `results[0].url` tồn tại → trả `{ success: true, data: { url }, meta: { timestamp } }`.
- Thất bại (không có `file` / upstream non-2xx / `success !== true` / thiếu `results[0].url` / lỗi mạng) → `{ success: false, error: { message }, meta: { timestamp, path: "/api/upload" } }` (400 khi thiếu file, 502 cho lỗi upstream).
- `components/common/image-upload.tsx`: gửi field `file` + `server` (mặc định `"server_1"`), parse shape bọc mới (`data.url` / `error.message`); client chặn trước MIME `image/*` và kích thước < 10MB. Bỏ prop `bucket`/`folder`; giữ `removeImage` best-effort dọn URL Supabase cũ (URL ngoài bucket tự no-op).
- `/api/upload` không public → proxy tự chặn người chưa đăng nhập (không cần gác thêm).
- Không migration DB, không env mới (đã bỏ `UPANHNHANH_API_KEY`).

## Capabilities

### New Capabilities

- `image-upload`: upload ảnh qua API bên thứ 3, trả link public.

### Modified Capabilities

(không có — component giữ nguyên hành vi với form dùng nó)

## Impact

- `app/api/upload/route.ts` — mới.
- `components/common/image-upload.tsx` — đổi hàm upload, bỏ prop `bucket`/`folder`, mặc định 10MB.
- `components/users/users-manager.tsx` — bỏ `folder="avatars"`.
- `.env.example` — bỏ `UPANHNHANH_API_KEY` (không còn cần key).
- `lib/supabase/storage.ts` giữ nguyên (`removeImage` còn dùng dọn ảnh Supabase cũ; `uploadImage` không còn ai gọi).
