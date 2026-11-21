## Why

Đội bán hàng dùng 2 ngôn ngữ (Việt + Anh) nên bản tóm tắt AI chỉ có 1 ngôn ngữ thì nửa đội đọc không được. Khung "Quick portrait" (chân dung nhanh) ở popup 360° thường bỏ trống vì phải nhập tay, trong khi AI đọc hội thoại đã nắm được mong muốn, nỗi lo, tính cách… của khách.

## What Changes

- Prompt Claude trả **JSON có cấu trúc** (structured outputs `output_config.format`): `summary_vi`, `summary_en` và `portrait` gồm 6 mục (wish, pain, preference, behavior, communication, personality), mỗi mục `{vi, en}` — chuỗi rỗng khi hội thoại không đủ căn cứ.
- `customer_chat_summaries`: cột `summary` = bản tiếng Việt, thêm `summary_en`. Không còn tóm tắt theo ngôn ngữ giao diện của người bấm.
- `customer_portrait_entries`: thêm `text_en`, nguồn thêm giá trị `ai`. Sau mỗi lần tóm tắt, mục nào AI có nội dung thì **thêm 1 bản chân dung nguồn AI** — CHỈ khi mục đó chưa có gì hoặc bản mới nhất cũng là AI (và nội dung khác). Người dùng ghi đè bằng cách thêm bản mới như cũ (bản mới nhất thắng); lần tóm tắt sau không đè lên bản người nhập.
- UI: khung Tóm tắt AI có nút chuyển VI / EN (mặc định theo ngôn ngữ giao diện: `vi` → VI, còn lại → EN). Chân dung hiển thị `text_en` khi giao diện không phải tiếng Việt và có bản EN. Nhãn nguồn "AI" (tím).

## Impact

- Migration `supabase/migrations/20261121090000_chat_summary_bilingual_portrait.sql` (chạy trước khi deploy).
- Sửa `lib/chat-summary.ts`, `lib/customer-360.ts`, `app/(app)/customers/customer-360-actions.ts`, `app/lead-form/actions.ts`, `types/customer-360.ts`, `components/customers/customer-360/{activity-tabs,profile-tabs,customer-360-modal}.tsx`, `messages/{vi,en}.json`.
- Bản tóm tắt cũ (trước thay đổi) chỉ có 1 ngôn ngữ, nằm ở cột `summary` → bấm "Tóm tắt lại" để có đủ 2 ngôn ngữ + chân dung.
