## Why

Popup hồ sơ 360° có tab Hội thoại (30 tin SMAX gần nhất), nhưng muốn nắm khách thì phải đọc hết. Sếp muốn có AI tóm tắt nhanh hội thoại, và lưu lại bản tóm tắt để lần mở sau không phải gọi AI lại (đỡ tốn tiền).

## What Changes

- Thêm biến môi trường `ANTHROPIC_API_KEY` (chỉ dùng phía server, không có tiền tố `NEXT_PUBLIC_`). Cài `@anthropic-ai/sdk`.
- Bảng mới `customer_chat_summaries`, mỗi khách 1 dòng (upsert khi tóm tắt lại). Lưu nội dung tóm tắt, giờ tin mới nhất đã tóm tắt, số tin, model, người tạo, giờ tạo.
- Server action `summarizeCustomerChat(customerId, locale)`: lấy 30 tin SMAX mới nhất (SMAX lỗi thì dùng bản chụp), gửi Claude (`claude-opus-5-5`, effort `low`, bật fallback phía server khi model từ chối), rồi lưu kết quả. Tóm tắt bằng ngôn ngữ giao diện của người bấm.
- **Tự tóm tắt khi tạo khách từ lead-form:** khách mới có tin SMAX thì sau khi lưu xong, server chạy tóm tắt nền bằng `after()` (form không phải chờ), dùng luôn bản chụp 30 tin, người tạo = Telesales đã chọn. Cập nhật khách cũ thì không tự chạy. Lỗi AI chỉ ghi log, không ảnh hưởng việc lưu khách.
- Phần gọi Claude tách ra `lib/chat-summary.ts` (server-only), dùng chung cho nút bấm và lead-form.
- `getCustomer360` trả thêm `chat_summary`.
- Tab Hội thoại: thêm khung "Tóm tắt AI" phía trên ô tìm. Chưa có bản tóm tắt thì hiện nút "Tóm tắt bằng AI"; có rồi thì hiện nội dung, giờ tạo, người tạo và nút "Tóm tắt lại". Có tin mới sau bản tóm tắt thì hiện nhãn "Có tin mới".

## Impact

- Migration `supabase/migrations/20261120130000_customer_chat_summary.sql` (chạy trước khi deploy).
- Thêm `lib/chat-summary.ts`. Sửa `app/lead-form/actions.ts`, `app/(app)/customers/customer-360-actions.ts`, `types/customer-360.ts`, `components/customers/customer-360/{activity-tabs,customer-360-modal}.tsx`, `messages/{vi,en}.json`, `.env.example`.
- Dữ liệu hội thoại khách được gửi sang Anthropic mỗi lần bấm tóm tắt.
