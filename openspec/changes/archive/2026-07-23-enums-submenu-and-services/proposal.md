# Proposal: enums-submenu-and-services

## Why

Trang `/enums` hiện gộp cả 3 danh mục (stage/source/lost_reason) vào một trang dài — khó điều hướng và không mở rộng được khi thêm danh mục mới. Đồng thời CRM cần quản lý danh mục **dịch vụ** (services) — một thực thể nghiệp vụ riêng (sẽ gắn với khách hàng sau này) cần bảng DB riêng, CRUD riêng và tên đa ngôn ngữ (vi/en/id).

## What Changes

- Tách `/enums` thành các trang con theo kind: `/enums/stage`, `/enums/source`, `/enums/lost_reason`; `/enums` redirect về `/enums/stage`. `EnumsManager` render 1 kind mỗi trang.
- Sidebar: mục "Danh mục" (admin) trở thành menu cha với 3 menu con (Giai đoạn / Nguồn / Lý do mất khách), highlight active theo path.
- Bảng mới `public.services` (name_vi/name_en/name_id, sort_order, is_active, timestamps) + RLS đọc-authenticated/ghi-admin — migration idempotent chạy tay.
- Trang admin mới `/services`: CRUD dịch vụ (bảng + dialog thêm/sửa/xóa/bật-tắt), menu sidebar riêng, gác admin trong `proxy.ts`.
- i18n: namespace `services` + `nav.services` cho cả vi/en/id.

## Capabilities

### New Capabilities
- `service-management`: Admin CRUD danh mục dịch vụ với tên 3 ngôn ngữ, thứ tự sắp xếp, bật/tắt kích hoạt.

### Modified Capabilities
- `enum-management`: Điều hướng danh mục đổi từ 1 trang gộp sang trang con theo kind + submenu sidebar (route mới, gác admin không đổi).

## Impact

- **DB:** migration mới `supabase/migrations/20260710*_services.sql` (bảng + trigger updated_at dùng chung + RLS).
- **Routes:** `app/(app)/enums/page.tsx` (redirect), mới `app/(app)/enums/[kind]/page.tsx`, mới `app/(app)/services/{page,actions}.tsx`.
- **Components:** `components/enums/enums-manager.tsx` (nhận prop kind), mới `components/services/services-manager.tsx`, `components/layout/app-sidebar.tsx` (submenu + mục Dịch vụ).
- **Khác:** `proxy.ts` (gác `/services`), `types/service.ts`, `messages/{vi,en,id}.json`.
