# Proposal: lead-form-ig-phone-optional

## Why

Khách nhắn qua Instagram thường chưa cho số điện thoại nhưng vẫn quan tâm (Tiềm năng / Cân nhắc). Lead form đang bắt buộc SĐT nên Telesales không ghi nhận được những khách này. Khách WhatsApp luôn có số nên vẫn bắt buộc.

## What Changes

- **Quy tắc:** nguồn Instagram (`source = 'instagrams'` — hội thoại SMAX không phải WhatsApp) → SĐT **không bắt buộc**; WhatsApp vẫn bắt buộc. Helper `phoneOptional(source)` ở `lib/customer-options.ts`.
- **Lưu trữ:** chưa có SĐT = chuỗi rỗng `''` (cột `customers.phone` vẫn `not null`, không đổi kiểu → không phải sửa các chỗ đang dùng `phone: string`).
- **Lead form:** ô SĐT bỏ dấu `*` + placeholder "Không bắt buộc với Instagram" khi nguồn là IG. Server chặn thiếu SĐT với WA. Cập nhật khách cũ mà để trống SĐT → **giữ SĐT đang có** trong CRM (form không điền sẵn SĐT từ CRM nên không được xoá nhầm).
- **Chống trùng SĐT:** `phoneOwner('')` trả null (nhiều khách IG cùng chưa có SĐT không bị coi là trùng). Migration unique index `20261119100000` (chưa chạy) thêm điều kiện `phone <> ''`.
- **Trang Khách hàng:** sửa khách IG được để trống SĐT (không bị kẹt khi sửa khách lead form tạo ra); tạo tay vẫn bắt buộc.

## Impact

- `lib/customer-options.ts`, `lib/customers.ts`, `app/lead-form/actions.ts`, `components/lead-form/lead-form.tsx`, `app/(app)/customers/actions.ts`, `components/customers/customers-manager.tsx`, `messages/{vi,en}.json`, `supabase/migrations/20261119100000_customer_phone_unique.sql`.
- Không đổi cấu trúc bảng.
