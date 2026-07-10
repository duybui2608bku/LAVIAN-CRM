# Design: enums-submenu-and-services

## Context

- `/enums` (admin) render `EnumsManager` với vòng lặp `KINDS` — 3 bảng xếp dọc trong 1 trang. Sidebar chỉ có 1 mục "Danh mục" trỏ `/enums`.
- `enum_options` là bảng lookup 3 ngữ có sẵn; `services` là thực thể nghiệp vụ riêng (sau này gắn customers) nên cần bảng riêng, không nhét làm kind thứ 4 của `enum_options`.
- Sidebar shadcn đã export `SidebarMenuSub/SubItem/SubButton`; chưa cài component `collapsible`.

## Goals / Non-Goals

**Goals:**
- Mỗi kind enum một trang con, URL riêng, sidebar submenu — thêm kind mới sau này chỉ thêm 1 entry.
- CRUD dịch vụ tối thiểu: tên 3 ngữ, thứ tự, kích hoạt — theo đúng pattern enums đã có.

**Non-Goals:**
- Không thêm giá/thời lượng/mô tả cho service (chưa yêu cầu — thêm cột khi cần).
- Không gắn service vào customers (change sau).
- Không icon/màu tag cho service (chưa có chỗ hiển thị tag).
- Không collapsible submenu (render tĩnh luôn mở — ít mục, không cần).

## Decisions

1. **Route động `app/(app)/enums/[kind]/page.tsx`** thay vì 3 page tĩnh: validate `kind` ∈ KINDS → `notFound()`; query 1 kind; `EnumsManager` nhận prop `kind` (bỏ vòng lặp KINDS, title = tên kind). `/enums` cũ `redirect("/enums/stage")` — giữ link/bookmark cũ sống. Proxy gác `startsWith("/enums")` đã phủ luôn route con, không sửa.
2. **Submenu tĩnh bằng `SidebarMenuSub`** (không cài `collapsible`): mục cha "Danh mục" là Link tới `/enums/stage`, active khi `pathname.startsWith("/enums")`; 3 sub-button active theo path đầy đủ. Khi sidebar thu gọn icon, sub tự ẩn (behavior mặc định của SidebarMenuSub), mục cha vẫn click được.
3. **Bảng `services` riêng, tối giản**: `id, name_vi, name_en, name_id, sort_order, is_active, created_at, updated_at`. Tái dùng `set_updated_at()`. RLS giống `enum_options`: select cho `authenticated`, all cho admin (`is_admin()`). Không soft-delete (giống enum_options); xóa cứng — chưa có bảng nào tham chiếu nên không cần check usage.
4. **`/services` là mục sidebar riêng cấp 1** (không nằm dưới "Danh mục") vì là thực thể nghiệp vụ, icon `Briefcase`, chỉ admin; `proxy.ts` thêm `/services` vào `isAdminRoute`.
5. **ServicesManager copy pattern EnumsManager rút gọn** (không value/icon/màu): bảng Vi/En/Id/Thứ tự ẩn trong dialog/Kích hoạt toggle/Thao tác; dialog react-hook-form + zod; actions `createService/updateService/deleteService` đều `requireAdmin()`; xóa confirm bằng `window.confirm` (đồng nhất enums-manager hiện tại).

## Risks / Trade-offs

- [Đổi URL `/enums` → `/enums/<kind>`] → redirect giữ tương thích; không có link nội bộ nào khác trỏ `/enums` ngoài sidebar (đã sửa).
- [Hard delete service] → chưa có gì tham chiếu; khi gắn customers sẽ thêm check usage như `deleteOption` (đã có pattern).
- [Submenu luôn mở chiếm chỗ dọc] → chỉ 3 mục; nếu menu phình thêm thì cài `collapsible` sau.

## Migration Plan

1. Chạy tay `supabase/migrations/20260710100000_services.sql` trong Supabase SQL Editor (idempotent, phụ thuộc `is_admin()` từ migration user-management).
2. Deploy code — trang `/services` trống cho tới khi migration chạy (query trả lỗi bảng không tồn tại → hiện danh sách rỗng).
