## Why

Tài liệu nội bộ ngày càng nhiều, đang hiện dạng lưới thẻ không phân loại — khó tìm "quy định nào", "tài liệu học tập
nào". Cần danh mục cố định và danh sách dạng bảng (tiêu đề, danh mục, người tạo, ngày tạo…) để quét nhanh.

## What Changes

- **DB** (migration `20261117110000_document_categories.sql`): cột `documents.category text not null default 'other'`
  + check trong 7 giá trị. Tài liệu cũ tự về "Khác".
- **Danh mục cố định trong code** (`lib/document-categories.ts`, giống stage/source của khách hàng): Quy định,
  Quy chế, Học tập, Quy trình, Biểu mẫu, Thông báo, Khác — nhãn qua i18n, màu tag preset antd.
- **Soạn tài liệu**: ô chọn Danh mục (bắt buộc) đầu cột phải.
- **`/documents`**: bỏ lưới thẻ → `DataTable` (điện thoại tự thành thẻ): Tiêu đề (+ tag PDF), Danh mục, Bộ phận (chỉ admin),
  Người tạo, Ngày tạo (sắp xếp được, mặc định mới nhất), Thích / Bình luận, Thao tác (admin). Toolbar thêm lọc danh mục.
- **Trang xem**: tag danh mục cạnh tác giả.

## Non-goals

- Không cho admin tự thêm/sửa danh mục ở `/enums` (dự án đã chuyển danh mục sang code; thêm danh mục = sửa code + check DB).
- Không danh mục con, không nhiều danh mục / tài liệu.

## Impact

- `supabase/migrations/20261117110000_document_categories.sql`, `lib/document-categories.ts`, `types/document.ts`,
  `app/(app)/documents/{actions.ts,page.tsx,[id]/page.tsx,[id]/edit/page.tsx}`,
  `components/documents/{documents-list,document-editor,document-view}.tsx`, `messages/{vi,en}.json`.
