# Design: customer-services-link

## Context

`services` (CRUD admin) và `customers` (CRUD mọi user, lọc client-side qua `matchesCustomerFilters`) đã chạy độc lập. Ghi chú session trước: khi gắn service vào customers phải thêm check usage vào `deleteService`. Trang /customers đã có pattern: page server query song song → props vào `CustomersManager`; dialog rhf+zod; lọc bằng `ClearableSelect`.

## Goals / Non-Goals

**Goals:**
- Khóa ngoại thật ở DB giữa customer và service (bảng nối many-to-many).
- Gắn/bỏ nhiều dịch vụ cho 1 khách trong dialog tạo/sửa.
- Cột "Dịch vụ" trên bảng + bộ lọc theo 1 dịch vụ (client-side, đồng nhất các bộ lọc hiện có).
- Chặn xóa service đang được dùng (app-level message + FK restrict ở DB).

**Non-Goals:**
- Không lưu thuộc tính trên quan hệ (giá, ngày mua, trạng thái từng dịch vụ) — thêm cột vào bảng nối khi nghiệp vụ cần.
- Không lọc nhiều dịch vụ cùng lúc.
- Không đụng UI /services (chỉ sửa action delete).

## Decisions

1. **Bảng nối `customer_services` thay vì cột mảng `uuid[]`** — yêu cầu là "tạo khóa": chỉ bảng nối mới có FK thật (`service_id` restrict chặn xóa ở tầng DB, `customer_id` cascade dọn theo khách). PK kép `(customer_id, service_id)` chống trùng. Không cột `id` riêng (YAGNI).
2. **Đọc bằng nested select PostgREST** `customers.select("*, customer_services(service_id)")` → page map thành `service_ids: string[]` trên `Customer`. Không thêm query riêng, không N+1.
3. **Ghi bằng delete-all-insert** trong `createCustomer`/`updateCustomer` (xóa hết dòng nối của khách rồi insert lại theo mảng gửi lên). 2 câu lệnh không transaction — chấp nhận (dữ liệu nhỏ, lỗi giữa chừng chỉ mất tag dịch vụ, sửa lại được ngay); nâng cấp RPC khi thành vấn đề. Không thêm action riêng.
4. **UI chọn dịch vụ = `MultiSelect`** (component dùng chung `components/common/multi-select.tsx`, theo feedback thay chip toggle): trigger style như `SelectTrigger` hiện badge đã chọn/placeholder (children thay được nội dung trigger), popover danh sách toggle + check — Radix Select không hỗ trợ multi nên dựng trên Popover có sẵn, không thêm dependency. Dùng ở 2 chỗ: dialog (controlled qua RHF Controller, bắn onValueChange mỗi toggle) và inline bảng (`InlineServices` giữ draft, **lưu 1 lần khi đóng popover** nếu đổi — tránh spam server action + toast mỗi toggle). `patchCustomer` whitelist thêm `service_ids` → `syncServices`. Nâng cấp ô search trong popover khi danh sách dài.
5. **Lọc theo 1 dịch vụ** qua `ClearableSelect` + `CustomerFilters.serviceId` trong `matchesCustomerFilters` (thuần, test được) — đồng nhất stage/source/staff.
6. **Tên dịch vụ theo locale**: helper `serviceName(s, locale)` trong `lib/customers.ts` cạnh `optionLabel` (fallback `name_vi` — cùng quy tắc nhãn enum).
7. **`deleteService` check usage** bằng `count head:true` trên `customer_services` (pattern `deleteOption`), trả message gợi ý tắt Kích hoạt. Đếm **mọi dòng nối** (kể cả của khách đã soft-delete) để khớp đúng hành vi FK restrict — tránh app nói "không ai dùng" mà DB vẫn chặn.

## Risks / Trade-offs

- [Ghi 2 bước không transaction] → hiếm, tự sửa được qua dialog; RPC jsonb khi cần.
- [Khách soft-delete vẫn giữ dòng nối] → đúng chủ ý (khôi phục còn nguyên tag); hệ quả: dịch vụ chỉ gắn với khách đã soft-delete vẫn không xóa được — tắt Kích hoạt là đủ.
- [Lọc client-side] → cùng ceiling đã ghi cho các bộ lọc khác; chuyển server khi dữ liệu lớn.

## Migration Plan

1 file `supabase/migrations/20260710120000_customer_services.sql`, idempotent, chạy tay SAU `20260710100000_services.sql`. Rollback: `drop table customer_services`.
