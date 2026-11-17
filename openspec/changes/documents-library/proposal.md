## Why

Cần một nơi lưu tài liệu nội bộ (quy trình, kịch bản tư vấn, bảng giá…) ngay trong CRM: admin soạn/đăng,
nhân viên đọc theo đúng bộ phận, bày tỏ (like) và hỏi đáp (comment) ngay dưới tài liệu.

## What Changes

- **DB** (migration `20261117090000_documents.sql`):
  - `documents` (title, `content jsonb` = JSON Tiptap, `pdf_path` = file trong bucket `documents`,
    `departments user_department[]` — rỗng = mọi bộ phận, `created_by`, timestamps).
  - `document_likes` (PK `document_id, user_id`), `document_comments` (body ≤ 2000 ký tự).
  - Hàm `can_view_document(departments)` (security definer): admin, hoặc mảng rỗng, hoặc bộ phận của user nằm trong mảng.
  - RLS: đọc tài liệu theo `can_view_document`; ghi tài liệu chỉ admin. Like/comment chỉ trên tài liệu xem được,
    `user_id = auth.uid()`; xoá comment = chủ comment hoặc admin.
  - Storage: bucket **private** `documents` (chỉ `application/pdf`, ≤ 30MB). Ghi = admin; đọc = khi có dòng
    `documents.pdf_path = name` mà user xem được (RLS lồng) → link ký 1 giờ, user khác bộ phận không lấy được.
- **Soạn thảo (admin)**: `/documents/new`, `/documents/[id]/edit` — editor **Tiptap** (StarterKit + Image):
  heading, đậm/nghiêng/gạch chân, danh sách, trích dẫn, link, ảnh (nút chèn / dán / kéo thả → `/api/upload` CDN sẵn có).
  Chọn bộ phận được xem (bỏ trống = tất cả). Đính kèm 1 PDF.
  **Import Google Docs**: dán link tài liệu đã chia sẻ "Bất kỳ ai có đường liên kết" → server tải bản export HTML,
  chuyển style class (đậm/nghiêng/gạch chân) thành inline, bỏ link chuyển hướng của Google, tải lại ảnh lên CDN,
  đổ vào editor (admin sửa tiếp rồi lưu). Dán trực tiếp từ Google Docs vào editor cũng được.
- **Xem (mọi user)**: `/documents` danh sách (tìm theo tên, số like/comment, admin thấy tag bộ phận + sửa/xoá);
  `/documents/[id]` nội dung (Tiptap chỉ đọc — chỉ node trong schema nên an toàn, không `dangerouslySetInnerHTML`),
  khung PDF + nút mở tab mới, nút Thích, danh sách bình luận + ô gửi, xoá bình luận của mình (admin xoá mọi bình luận).
- Menu "Tài liệu" hiện cho mọi user đăng nhập (không qua cây phân quyền — lọc theo từng tài liệu bằng RLS).

## Non-goals

- Không phiên bản/lịch sử sửa, không nháp/lịch đăng, không thông báo, không realtime bình luận, không trả lời lồng nhau.
- Không bảng (table) trong editor — bảng từ Google Docs chỉ giữ lại chữ.

## Impact

- `supabase/migrations/20261117090000_documents.sql`, `types/document.ts`, `lib/google-docs.ts` (+ test),
  `lib/upload.ts` (tách logic upload CDN dùng chung route + import), `app/api/upload/route.ts`,
  `app/(app)/documents/**`, `components/documents/**`, `components/layout/app-shell.tsx`, `messages/{vi,en}.json`,
  `package.json` (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image`).
