## Why

Cần biết khách ở tỉnh / huyện-thành phố nào của Indonesia (+ địa chỉ chi tiết) để phân loại và lọc khách theo khu vực.

## What Changes

- Dữ liệu: `lib/id-regions.json` (38 tỉnh, 514 huyện/thành phố, ~17 KB) lấy từ
  [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah) (MIT, Kepmendagri No 300.2.2-2138/2025), chỉ giữ 2 cấp.
  Nhúng tĩnh trong repo, KHÔNG gọi API ngoài lúc chạy. Dạng `[[mãTỉnh, tên, [[mãHuyện, tên], ...]], ...]`.
  Helper `lib/id-regions.ts`: `PROVINCES`, `citiesOf`, `regionNames`.
- DB (migration `20261113100000_customer_region.sql`):
  - `customers.region_code text` — mã Kemendagri `"31"` (chỉ tỉnh) hoặc `"31.71"` (tỉnh + huyện/TP); tỉnh = 2 ký tự đầu nên 1 cột đủ. Check định dạng.
  - `customers.address_detail text` — địa chỉ chi tiết tự do (≤ 500 ký tự, chặn ở app).
- `RegionSelect` (`components/common/region-select.tsx`): 2 Select có tìm kiếm trên **1 hàng 2 cột** (Tỉnh | Huyện/TP);
  huyện khoá khi chưa chọn tỉnh, đổi tỉnh xoá huyện.
- `/customers`: drawer tạo/sửa thêm "Khu vực" + "Địa chỉ chi tiết"; bảng thêm cột "Khu vực" (huyện/TP + tỉnh, hover xem địa chỉ);
  thanh lọc thêm Select "Tất cả tỉnh" (lọc client-side theo 2 số đầu `region_code`).
- Form SMAX (`/lead-form`): thêm "Khu vực" + "Địa chỉ chi tiết" dưới SĐT; khách đã có → fill giá trị CRM (bỏ qua ô đã chạm),
  đổi khách → reset; submit/update ghi cả 2 cột.

## Không làm (YAGNI)

- Cấp quận (kecamatan) / xã (desa).

## Impact

- `supabase/migrations/20261113100000_customer_region.sql`, `lib/id-regions.{json,ts}`, `lib/customers{,.test}.ts`,
  `components/common/region-select.tsx`, `types/customer.ts`, `app/(app)/customers/{page,actions}.ts(x)`,
  `components/customers/customers-manager.tsx`, `app/lead-form/actions.ts`, `components/lead-form/lead-form.tsx`,
  `messages/{en,vi}.json`.
