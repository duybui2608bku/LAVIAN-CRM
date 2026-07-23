# Tasks: appointment-payments-ledger

## 1. Database

- [x] 1.1 Migration `supabase/migrations/<ts>_appointment_payments.sql`: tạo bảng `appointment_payments` (kind/amount>0/method/image_url/note/paid_at/created_by) + index `(appointment_id, paid_at desc)` + RLS authenticated toàn quyền; idempotent
- [x] 1.2 Cùng migration: backfill bọc `do $$` (check cột `deposit_amount` tồn tại) — deposit_amount>0 → dòng `deposit`; completed có final>deposit → dòng `payment` (final−deposit, note `backfill`); rồi `drop column deposit_amount`; ghi chú ROLLBACK cuối file

## 2. Types & helpers

- [x] 2.1 `types/appointment.ts`: thêm `PAYMENT_KINDS`/`PaymentKind`, interface `AppointmentPayment`; `Appointment` bỏ `deposit_amount`, thêm `payments: AppointmentPayment[]`; `AppointmentInput` bỏ `deposit_amount`, thêm `deposit?: { amount: number; payment_method?: PaymentMethod | null; image_url?: string | null }` (chỉ dùng khi tạo)
- [x] 2.2 `lib/appointments.ts`: thêm `paidTotal(a)` (Σ deposit+payment − refund); sửa `outstanding(a)` dùng paidTotal; cập nhật `lib/appointments.test.ts` (thêm case paidTotal/refund) — `node --test` PASS

## 3. Server actions (`app/(app)/appointments/actions.ts`)

- [x] 3.1 Transition whitelist `ALLOWED_TRANSITIONS` + validate trong `setAppointmentStatus` (đọc status hiện tại, từ chối transition lạ); hoàn tác xóa timestamp mốc vừa rời (`checked_in_at`/`completed_at`/`cancelled_at` = null); `completed` nhận thêm `payment` (amount/method/image_url) → insert dòng sổ sau khi update status
- [x] 3.2 `createAppointment`: bỏ deposit_amount khỏi `clean()`; nếu `input.deposit.amount > 0` insert dòng `deposit` sau khi tạo lịch; `stageTargetFor` dùng số cọc này
- [x] 3.3 Action mới `addPayment(appointmentId, {kind, amount, payment_method, image_url, note})` (validate kind whitelist + amount>0, created_by = user) và `deletePayment(id)` (trả image_url để client dọn ảnh best-effort); cả hai `refresh()`

## 4. UI

- [x] 4.1 `components/appointments/payments-dialog.tsx` mới: bảng dòng sổ (ngày giờ, tag loại, số tiền ±, phương thức, thumbnail ảnh mở tab mới, ghi chú, avatar người tạo) + dòng tổng Đã thu/Còn nợ + form thêm (loại, CurrencyInput, phương thức, ImageUpload folder `payments`, ghi chú) + xóa dòng AlertDialog
- [x] 4.2 `appointments-manager.tsx`: cột "Cọc" → "Đã thu" (paidTotal), Còn nợ theo helper mới; nút Wallet mở PaymentsDialog ở cột thao tác; nút hoàn tác `Undo2` cho `checked_in` (→booked) và `completed` (→checked_in); nút hủy thêm cho `checked_in`; CompletePopover 4 field (final + thu lần này prefill final−đã thu + phương thức + ảnh)
- [x] 4.3 `appointment-dialog.tsx`: mode tạo — ô Cọc + ImageUpload ảnh cọc (gửi `deposit`); mode sửa — bỏ ô Cọc, hiện "Đã thu" read-only + nút mở PaymentsDialog
- [x] 4.4 `customers-manager.tsx` (dialog lịch sử lịch hẹn): mỗi lịch hiện Đã thu; dòng cuối "Tổng đã trả" = Σ paidTotal
- [x] 4.5 Page queries: `/appointments` + `/customers` nested select thêm `appointment_payments(*)` → map `payments` (sort paid_at desc)
- [x] 4.6 `payments-dialog.tsx`: form thêm dòng tách 4 hàng (loại / số tiền / phương thức / ghi chú, mỗi field 1 hàng); chặn thu quá số còn phải thu — nhập vượt (tính cả các lần thu trước) ép về đúng số còn nợ, chỉ áp cho `kind=payment` khi có số chốt/báo giá

## 5. i18n

- [x] 5.1 `messages/{vi,en,id}.json` namespace `appointments`: key mới (paid, outstanding giữ, payments, addPayment, kind_deposit, kind_payment, kind_refund, undo, cameNoService?, totalPaid, receiptImage, amountThisTime, invalidTransition…) — bỏ key cọc hết dùng nếu có

## 6. Kiểm chứng

- [x] 6.1 `node --test lib/appointments.test.ts` PASS; `tsc --noEmit` sạch; eslint file sửa sạch; JSON.parse 3 messages; `next build` PASS
- [x] 6.2 Cập nhật `memory-bank/README.md` (mục nhật ký + trạng thái hiện tại); nhắc user chạy migration trong SQL Editor
