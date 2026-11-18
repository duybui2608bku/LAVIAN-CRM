# Tasks: potential-customers-page

## 1. Database
- [x] 1.1 Migration `20261118130000_potential_customers.sql`: stage `consider`, cột `potential_status` / `follow_up_at` / `converted_at`, index, 2 function thông báo, 2 cron

## 2. Server
- [x] 2.1 `lib/customer-options.ts` stage `consider` + option `potential_status`; `types/customer.ts`
- [x] 2.2 `patchCustomer` nhận `potential_status`, `follow_up_at`; action `convertPotentialCustomer`; revalidate `/customers/potential`

## 3. UI
- [x] 3.1 Export `NotesModal`, `SourceCell` từ `customers-manager.tsx`
- [x] 3.2 `app/(app)/customers/potential/page.tsx` + `components/customers/potential-manager.tsx`
- [x] 3.3 Menu con "Khách tiềm năng"; chuông bật lại + chữ cho `follow_up_due` / `follow_up_digest`
- [x] 3.4 i18n vi/en

## 4. Kiểm chứng
- [x] 4.1 tsc + eslint + test
- [x] 4.2 Chạy migration trên Supabase (đã chạy 2026-11-18 + thử rollback)
- [ ] 4.3 Xem tay trên trình duyệt
