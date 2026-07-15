# Tasks: upload-image-third-party

## 1. Server

- [x] 1.1 `app/api/upload/route.ts`: POST nhận `file` + `server`, forward `images[]` + `server` tới `https://cfig.ibytecdn.org/upload` (không API key, không header thủ công), trả `{ success, data: { url }, meta }` / `{ success: false, error: { message }, meta }`
- [x] 1.2 `.env.example`: bỏ `UPANHNHANH_API_KEY` (upstream mới không cần key)

## 2. Client

- [x] 2.1 `components/common/image-upload.tsx`: gửi FormData `file` + `server` ("server_1"), parse shape bọc mới, mặc định 10MB, bỏ prop `bucket`/`folder`, giữ `removeImage` dọn URL Supabase cũ
- [x] 2.2 `components/users/users-manager.tsx`: bỏ `folder="avatars"`

## 3. Kiểm chứng

- [x] 3.1 `tsc --noEmit`: diff này 0 lỗi
- [x] 3.2 Smoke-test upstream bằng curl: POST ảnh 1px `images[]` + `server=server_1` → HTTP 200, `{success:true, results:[{url: "https://i.ibytecdn.org/img/...", server: "server_1"}]}` — đúng contract
- [ ] 3.3 Test end-to-end qua app (chạy dev + đăng nhập + upload từ form)
