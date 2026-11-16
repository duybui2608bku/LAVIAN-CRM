## Why

Ô Số điện thoại (form khách hàng `/customers` và `/lead-form`) vẫn nhập và lưu được chữ cái — trước đây chỉ bỏ dấu "+", không kiểm tra gì thêm.

## What Changes

- Thêm `isValidPhone` (`lib/phone.ts`): hợp lệ khi chỉ gồm chữ số, khoảng trắng, "-" (dấu "+" bỏ qua) và có ít nhất 1 số.
- Form `/customers` và `/lead-form`: SĐT có chữ/ký tự lạ → **báo lỗi "Số điện thoại không hợp lệ"** dưới ô, không cho lưu (không tự xoá ký tự người dùng gõ).
- Server cũng chặn: `customers/actions.ts` ném lỗi, `lead-form/actions.ts` zod `refine(isValidPhone)`.
- i18n: thêm `customers.phoneInvalid` (vi/en). Không đổi DB.

## Impact

- `lib/phone.ts`, `lib/phone.test.ts`, `components/customers/customers-manager.tsx`, `components/lead-form/lead-form.tsx`, `app/(app)/customers/actions.ts`, `app/lead-form/actions.ts`, `messages/{vi,en}.json`
