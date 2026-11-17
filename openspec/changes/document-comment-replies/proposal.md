## Why

Bình luận tài liệu cần hỏi–đáp theo luồng (trả lời 1 bình luận cụ thể), và khung PDF đang hiện cả trình xem PDF
của trình duyệt (thanh công cụ, ô ảnh trang, zoom…) — rối, người dùng chỉ cần đọc file.

## What Changes

- **DB** (migration `20261117100000_document_comment_replies.sql`): cột `document_comments.parent_id` (FK tự trỏ,
  `on delete cascade`, index). Chỉ **1 cấp** trả lời kiểu Facebook: trigger BEFORE INSERT kiểm tra bình luận cha
  cùng tài liệu và gắn câu trả lời của 1 câu trả lời vào bình luận gốc (policy không tự truy vấn bảng mình được — 42P17).
- **Bình luận**: mỗi bình luận hiện avatar + tên + thời gian; nút "Trả lời" mở ô trả lời ngay dưới luồng
  (placeholder "Trả lời <tên>…"); câu trả lời thụt vào dưới bình luận gốc. Ô viết bình luận hiện avatar người đang
  đăng nhập. Xoá bình luận gốc xoá luôn các trả lời (hỏi xác nhận nói rõ).
- **PDF**: iframe mở với `#toolbar=0&navpanes=0&view=FitH` — trình xem Chrome/Edge ẩn thanh công cụ + ô ảnh trang,
  trang vừa chiều ngang. Vẫn giữ nút "Mở PDF" (tab mới, điện thoại).

## Non-goals

- Không trả lời lồng nhiều cấp, không sửa bình luận, không thông báo/realtime.
- Không tự vẽ PDF bằng pdf.js (Firefox vẫn hiện thanh công cụ của nó; điện thoại vẫn chỉ nút mở tab mới).

## Impact

- `supabase/migrations/20261117100000_document_comment_replies.sql`, `types/document.ts`,
  `app/(app)/documents/{actions.ts,[id]/page.tsx}`, `components/documents/document-view.tsx`, `messages/{vi,en}.json`.
