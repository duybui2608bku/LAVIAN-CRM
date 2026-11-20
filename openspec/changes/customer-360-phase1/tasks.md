# Tasks: customer-360-phase1

## 1. Database

- [x] 1.1 Migration `20261120120000_customer_360.sql` (chạy lại an toàn):
  - bảng `customer_portrait_entries`, `customer_needs`, `appointment_performers`, `appointment_photos` kèm RLS
  - bucket riêng tư `ba-photos` kèm policy Storage
  - cột `customers.smax_messages`, `smax_messages_at`
  - 2 check `NOT VALID` cho trạng thái lịch hẹn
  - RPC `set_appointment_performers`
  - phần ROLLBACK
- [x] 1.2 Chạy thử migration trong khối rollback trên Supabase Lavian để kiểm tra (người dùng tự chạy bản thật)

## 2. Logic thuần (có test)

- [x] 2.1 `lib/customer-360.ts`: `customerRole`, `canSeeFinance`, `canSeePhotos`, `customerFinance`, `latestPortrait`, `nextNeed`, `mergeTimeline`, danh sách vai trò người thực hiện + nguồn + trạng thái nhu cầu
- [x] 2.2 `lib/appointments.ts`: `validateVisitStatus` (E3), `canSetVisitStatus` (Master được chọn `done`), cập nhật test
- [x] 2.3 `lib/customer-360.test.ts` + test bổ sung trong `lib/appointments.test.ts`

## 3. Server

- [x] 3.1 `types/customer-360.ts`; cập nhật `types/appointment.ts` (performers)
- [x] 3.2 `app/(app)/customers/customer-360-actions.ts`: `getCustomer360` (ẩn tài chính/ảnh ở server), `addPortraitEntry`, `addCustomerNeed`, `setNeedStatus`, `addAppointmentPhoto`, `deleteAppointmentPhoto`, `setAppointmentPerformers`
- [x] 3.3 `patchAppointment` / `createAppointment`: áp dụng E3 + quyền trạng thái mới
- [x] 3.4 `lib/smax-messages.ts`: `fetchThreadMessages(link, limit)` mặc định 30; lead-form lưu bản chụp `smax_messages` (lỗi thì bỏ qua)

## 4. UI

- [x] 4.1 `components/customers/customer-360/`: modal + header/3 ô tóm tắt + Trước/Tiếp + cột trái + footer
- [x] 4.2 Tab Tổng quan, Chân dung (nhập + nhãn nguồn + gắn tin gốc + lịch sử), Dịch vụ & Upsell (pipeline + tài chính 3 vùng)
- [x] 4.3 Tab Ảnh B/A (gom theo lịch), Hội thoại (tách `ChatBubbles` từ `MessagesModal`, ô tìm), Lịch sử & Ghi chú (timeline + lọc + ghi chú nhanh), CSKH (Coming soon)
- [x] 4.4 Drawer Sales: Người thực hiện thêm, upload Ảnh B/A, "Phải thu: Chưa xác định", lỗi E3 tại field, Master chọn được Đã thực hiện
- [x] 4.5 Gắn popup: Quản lý bán hàng (tên khách → popup), Quản lý khách hàng, Khách tiềm năng, Quản lý đặt lịch (nút mở popup), truyền danh sách id đang lọc
- [x] 4.6 i18n vi/en (dự án chỉ còn 2 locale, không có `id`; thuật ngữ vi theo quy ước: Telesales · Sales · Master)

## 5. Kiểm chứng

- [x] 5.1 tsc + eslint + node --test sạch
- [x] 5.2 Rà soát tối giản (ponytail)
- [ ] 5.3 Xem trên trình duyệt (hỏi trước khi bật dev server)
- [x] 5.4 Ghi memory-bank
