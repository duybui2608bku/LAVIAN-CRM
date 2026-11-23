# Proposal: portrait-ai-detect

## Why

Tab **Chân dung** (popup hồ sơ 360°) bắt nhân viên chọn **Mục** (Mong muốn / Nỗi lo / …) + gắn **Tin nhắn gốc** rồi mới nhập nội dung — chậm, và nhân viên hay chọn sai mục. Sếp muốn: nhân viên chỉ ghi **text thô** (kèm Nguồn), **AI tự nhận ra** thông tin đó thuộc mục chân dung nào.

## What Changes

- Form nhập chỉ còn **Nguồn** (Khách nói / NV nhận định) + **Nội dung**. Bỏ ô Mục và ô Tin nhắn gốc.
- Text thô lưu vào **danh mục ẩn** `general` trong `customer_portrait_entries` (không hiện ở 6 ô — chỉ để lưu vết bản gốc).
- Server gửi text thô + chân dung hiện tại cho Claude → trả về giá trị mới (song ngữ vi/en) cho **các mục mà ghi chú nói tới** (đã gộp với thông tin cũ còn đúng). Mỗi mục nhận ra = 1 dòng mới, `source` = Nguồn nhân viên chọn (nên tóm tắt AI hội thoại SMAX không đè lên).
- AI lỗi / thiếu key / không nhận ra mục nào → text thô **vẫn được lưu**, báo cảnh báo cho nhân viên.

## Non-goals

- Không đổi 6 ô hiển thị, cột trái "Chân dung nhanh", tóm tắt AI hội thoại SMAX.
- Không hiện danh sách ghi chú thô trên UI.

## Impact

- DB: `supabase/migrations/20261123130000_portrait_general_field.sql` — thêm `general` vào check `customer_portrait_entries_field_check`.
- Code: `lib/chat-summary.ts` (hàm `detectPortrait`, gom gọi Claude dùng chung), `app/(app)/customers/customer-360-actions.ts` (`addPortraitNote` thay `addPortraitEntry`, đọc chân dung bỏ `general`), `components/customers/customer-360/profile-tabs.tsx`, `messages/{vi,en,id}.json`.
