# Design: add-enum-tag-icons

## Context

- `enum_options` (kind ∈ stage/source/lost_reason) là bảng lookup do admin CRUD ở `/enums`; customers lưu value text, nhãn tra theo locale bằng `optionLabel`.
- Bảng `/customers` hiện render stage bằng `Badge` (destructive khi `lost`, còn lại secondary), source là text thường.
- `lucide-react@1.23` đã cài; entry `lucide-react/dynamic` export `iconNames` (mảng ~1600 tên kebab-case) và `DynamicIcon` (lazy-load từng icon theo chunk riêng).

## Goals / Non-Goals

**Goals:**
- IconPicker tìm kiếm toàn bộ icon Lucide, tái sử dụng (value = tên kebab-case, string).
- Admin gán icon + màu cho từng enum option; stage/source hiển thị thành tag ở bảng khách hàng.
- Không phình bundle client (không import tĩnh 1600 icon).

**Non-Goals:**
- Không đổi icon/màu ở các Select lọc & form khách hàng (chỉ bảng) — thêm sau nếu cần.
- Không upload icon tùy chỉnh / emoji; chỉ icon Lucide.
- Không migrate màu vào design token — màu là dữ liệu (hex) do admin chọn.

## Decisions

1. **Nguồn icon: `lucide-react/dynamic`** — `iconNames` để search, `DynamicIcon name=...` để render (React.lazy per-icon, Turbopack tách chunk). *Loại bỏ:* `import { icons } from "lucide-react"` (bundle cả bộ ~1600 icon vào client).
2. **IconPicker = Popover + Input + grid button.** Lọc substring trên `iconNames`, chỉ render tối đa 96 kết quả (đủ 1 màn cuộn; gõ thêm để thu hẹp — tránh mount 1600 lazy component). Có nút bỏ chọn. Value là `string` (kebab-case) để tái sử dụng, không phụ thuộc type `IconName`.
3. **Màu = hex `#rrggbb` lưu text.** UI: 12 swatch preset (bảng màu kiểu ClickUp, đọc được cả sáng/tối) + `<input type="color">` cho màu tùy chỉnh (native, luôn trả `#rrggbb`). *Loại bỏ:* thư viện color-picker (không cần dependency mới).
4. **Tag style từ 1 hex:** text = màu gốc, nền = hex + alpha `1A` (~10%), viền = hex + `40` (~25%) qua inline style — hoạt động cả light/dark, không cần token mới. Component `EnumTag` dùng chung (bảng customers + preview ở /enums). Option thiếu màu → fallback `Badge` secondary như cũ.
5. **Ràng buộc dữ liệu ở DB:** check constraint `color ~ '^#[0-9a-fA-F]{6}$'` và `icon ~ '^[a-z0-9-]+$'` (thêm idempotent qua `drop constraint if exists` + `add`). Server action chỉ pass-through — lỗi constraint đã được `normalizeError` xử lý.
6. **Seed màu mặc định** cho stage (new_lead xanh dương → lost đỏ) và source (màu brand gần đúng) bằng `update ... where color is null` — idempotent, không đè lựa chọn admin. Icon không seed (admin tự chọn).

## Risks / Trade-offs

- [Admin gõ tay icon không tồn tại] → không xảy ra qua UI (chỉ chọn từ picker); nếu dữ liệu rác, `DynamicIcon` fallback render null, tag vẫn hiện nhãn.
- [96 kết quả đầu có thể chưa chứa icon cần] → hiển thị đếm "x/y" để người dùng biết cần gõ thêm; search substring đủ hẹp sau 2–3 ký tự.
- [Màu tự chọn có thể kém tương phản] → nền chỉ 10% alpha nên chữ = màu gốc trên nền gần trong suốt; swatch preset đã chọn sẵn màu đạt tương phản khá; không chặn màu tùy ý (quyền admin).
- [DynamicIcon load async → tag "nhấp nháy" icon lúc đầu] → chấp nhận; icon nhỏ (size 12–14), chunk vài trăm byte, cache sau lần đầu.

## Migration Plan

1 file `supabase/migrations/20260708090000_enum_options_icon_color.sql`: `add column if not exists icon/color` + constraint (drop/add) + seed update. Chạy tay trong Supabase SQL Editor, an toàn chạy lại. Rollback: `alter table ... drop column icon, drop column color` (không phá dữ liệu khác).
