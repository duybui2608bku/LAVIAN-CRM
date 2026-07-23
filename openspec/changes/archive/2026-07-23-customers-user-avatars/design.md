# Design: customers-user-avatars

## Context

- Avatar user lưu ở `profiles.avatar_url` (URL công khai bucket `images`, host tùy ý). Header đã render bằng `<img>` trần + fallback `app/assets/avt.webp` (tránh cấu hình `next/image remotePatterns`).
- Bảng /customers: cột Nhân viên là `InlineSelect` với `display` là ReactNode → nhét avatar + tên vào `display` không đụng cơ chế select.
- Note lưu `by` = **tên snapshot** (string), không có id → tra avatar theo `user_name` trong danh sách staff, best-effort.

## Goals / Non-Goals

**Goals:**
- Avatar tròn nhỏ cạnh tên ở: cell Nhân viên (bảng) + mỗi mục lịch sử ghi chú.
- Fallback `avt.webp` khi thiếu avatar; không hỏng khi note cũ thiếu `by` hoặc user đổi tên.

**Non-Goals:**
- Không backfill `by_id` cho note cũ, không đổi cấu trúc note.
- Không thêm shadcn Avatar component (1 thẻ `<img>` là đủ, đúng pattern header).

## Decisions

1. **Helper `UserAvatar` nội bộ file** `customers-manager.tsx` (`<img src={src || fallback} className="size-5 rounded-full object-cover" />`) — dùng 2 chỗ trong cùng file, chưa cần tách ra `components/common/` (YAGNI; tách khi chỗ thứ 3 cần).
2. **Tra avatar người ghi note theo tên**: `staff.find(s => s.user_name === n.by)`. Trùng tên/đổi tên → có thể sai/miss avatar, chấp nhận (note chỉ lưu snapshot tên từ đầu). Không match → fallback ảnh mặc định; `by` rỗng → giữ "—" và vẫn hiện avatar mặc định để hàng đều nhau? — KHÔNG: `by` rỗng thì không hiện avatar (tránh gợi ý sai người).
3. **Query staff** thêm `avatar_url` — RLS `profiles_select_authenticated` đã cho phép, không cần migration.
4. **Option trong Select nhân viên cũng có avatar** (bổ sung theo feedback): nới `SelectOption.label` (clearable-select) và `options.label` (InlineSelect) từ `string` → `React.ReactNode`; helper module-level `staffLabel(s)` = avatar + tên dùng chung cho cell bảng, option inline select, option select thanh lọc và select trong dialog. `ItemText` của Radix nhận node và tự phản chiếu lên trigger khi được chọn.

## Risks / Trade-offs

- [Trùng `user_name` giữa 2 user] → avatar có thể lấy nhầm người cùng tên; hiếm, chấp nhận. Nâng cấp: stamp thêm `by_id` vào note mới.
- [`avatar_url` chết/404] → `<img>` vỡ ảnh; chấp nhận (header cùng hành vi). Nâng cấp: `onError` swap fallback.
