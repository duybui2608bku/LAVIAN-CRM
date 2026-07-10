# Tasks: customers-user-avatars

## 1. Data

- [x] 1.1 `app/(app)/customers/page.tsx`: thêm `avatar_url` vào select profiles + type cast

## 2. UI

- [x] 2.1 `customers-manager.tsx`: mở rộng type `Staff` (+`avatar_url`), thêm helper `UserAvatar` (img tròn size-5, fallback `avt.webp`)
- [x] 2.2 Cell Nhân viên: `display` của InlineSelect = avatar + tên (null → "—" như cũ)
- [x] 2.3 Dialog Lịch sử ghi chú: avatar người ghi cạnh tên (tra staff theo `user_name`, `by` rỗng → chỉ "—")
- [x] 2.4 Option Select nhân viên (inline/thanh lọc/dialog) kèm avatar: nới `label` → ReactNode, helper `staffLabel`

## 3. Kiểm chứng

- [x] 3.1 `tsc --noEmit` sạch + `next build` PASS
