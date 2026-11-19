# Proposal: customer-phone-dedupe

## Why

Rà BA (2026-11-19, mục D1): chống trùng khách không nhất quán. Drawer "Thêm lịch hẹn" tạo nhanh khách có chặn trùng SĐT, nhưng `/customers` (tạo/sửa) và lead form (chỉ dò theo `smax_customer_id`) thì không. Khách nhắn IG rồi chuyển sang WA có SMAX id khác → lead form tạo khách thứ 2 cùng SĐT (DB đang có 1 cặp như vậy).

## What Changes

- **Quy tắc chung:** SĐT là định danh khách — không có 2 khách chưa xoá cùng SĐT. Helper `phoneOwner()` (`lib/customers.ts`) dùng chung cho mọi đường tạo/sửa.
- **CRM:** `createCustomer` / `updateCustomer` báo "SĐT này đã thuộc khách {name}" (cùng thông báo drawer tạo lịch). `createAppointment` dùng lại helper.
- **Lead form (đã chốt: gộp, giữ kênh đầu):** không tìm thấy theo SMAX id thì dò tiếp theo SĐT (khách tạo trước nhất). Tìm thấy → form coi là khách cũ (điền sẵn CRM, chỉ Cập nhật). Cập nhật khách tìm theo SĐT **giữ nguyên** SMAX id, nguồn, hội thoại, tên MXH, avatar, tag, `smax_data` của kênh nhắn trước; chỉ ghi các trường CRM. Đổi SĐT sang số của khách khác → báo lỗi.
- **DB:** migration `20261119100000_customer_phone_unique.sql` — unique index SĐT trên khách chưa xoá (thay index thường `customers_phone_idx`). **Chỉ chạy sau khi đã xử lý cặp trùng hiện có** (người dùng tự xử lý trong CRM).

## Impact

- `lib/customers.ts`, `app/(app)/customers/actions.ts`, `app/(app)/appointments/actions.ts`, `app/lead-form/actions.ts`, `components/lead-form/lead-form.tsx`, migration mới.
