# Proposal: customers-user-avatars

## Why

Bảng /customers hiện chỉ hiển thị tên nhân viên phụ trách và tên người ghi chú dạng text — khó nhận diện nhanh bằng mắt. Avatar đã có sẵn trong `profiles.avatar_url` (upload từ trang /users) nhưng chưa được dùng ở đâu ngoài header.

## What Changes

- Cột **Nhân viên** trên bảng /customers hiển thị avatar (nhỏ, tròn) + tên; chưa gán nhân viên vẫn hiện "—".
- Dialog **Lịch sử ghi chú** hiển thị avatar người ghi cạnh tên (tra theo `by` — tên snapshot trong note).
- Avatar thiếu/URL rỗng → fallback ảnh `app/assets/avt.webp` (đúng pattern header).
- Query staff ở page mở rộng: `select id, user_name, avatar_url`.
- Không migration DB, không đổi Server Action.

## Capabilities

### New Capabilities

(không có)

### Modified Capabilities

- `customer-management`: cột Nhân viên và lịch sử ghi chú hiển thị thêm avatar user (yêu cầu hiển thị mới, không đổi dữ liệu).

## Impact

- `app/(app)/customers/page.tsx` — thêm `avatar_url` vào select profiles.
- `components/customers/customers-manager.tsx` — type `Staff`, cell Nhân viên, dialog lịch sử ghi chú.
- Không đụng DB/RLS (policy `profiles_select_authenticated` đã cho đọc profiles).
