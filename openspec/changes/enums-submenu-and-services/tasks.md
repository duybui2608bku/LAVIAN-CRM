# Tasks: enums-submenu-and-services

## 1. Enums tách trang con

- [x] 1.1 `components/enums/enums-manager.tsx`: nhận prop `kind`, bỏ vòng lặp KINDS, title theo kind
- [x] 1.2 Tạo `app/(app)/enums/[kind]/page.tsx` (validate kind → notFound, query 1 kind); `app/(app)/enums/page.tsx` → `redirect("/enums/stage")`
- [x] 1.3 Sidebar: mục "Danh mục" thành menu cha + 3 `SidebarMenuSub` con, active theo path

## 2. Services

- [x] 2.1 Migration `supabase/migrations/20260710100000_services.sql` (bảng + trigger + RLS, idempotent)
- [x] 2.2 `types/service.ts` (`Service`, `ServiceInput`)
- [x] 2.3 `app/(app)/services/actions.ts` (`createService`/`updateService`/`deleteService`, requireAdmin)
- [x] 2.4 `app/(app)/services/page.tsx` + `components/services/services-manager.tsx` (bảng + dialog + toggle + xóa confirm)
- [x] 2.5 `proxy.ts` thêm `/services` vào isAdminRoute; sidebar thêm mục "Dịch vụ" (admin)

## 3. i18n + kiểm chứng

- [x] 3.1 `messages/{vi,en,id}.json`: namespace `services` + `nav.services`
- [x] 3.2 `tsc --noEmit` sạch + `next build` PASS
- [x] 3.3 Cập nhật `memory-bank/README.md`

## 4. Đa ngôn ngữ không bắt buộc (bổ sung theo yêu cầu)

- [x] 4.1 Migration `20260710113000_optional_translations.sql` (drop not null `label_en`/`label_id`, `name_en`/`name_id`) + nới sẵn migration services gốc
- [x] 4.2 Types nullable (`EnumOption`, `Service`) + input actions enums nhận null
- [x] 4.3 Form enums/services: chỉ Vi bắt buộc, placeholder "Không bắt buộc", "" → lưu null; bảng hiện "—" khi trống
- [x] 4.4 `optionLabel` fallback tiếng Việt + test; i18n key `optional` (vi/en/id)
