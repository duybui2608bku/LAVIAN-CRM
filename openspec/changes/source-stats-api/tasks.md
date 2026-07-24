# Tasks: source-stats-api

## 1. Helper thuần + test

- [x] 1.1 Thêm `calculateSourceStats(options, customers, baseAmounts, upsaleAmounts)` vào `lib/financial.ts` (gộp theo nguồn, nguồn lạ giữ giá trị thô làm nhãn, khách chưa gắn nguồn → dòng `source: null`, chỉ trả dòng có phát sinh, sort revenue desc → data desc → sort_order)
- [x] 1.2 Thêm test vào `lib/financial.test.ts` (đủ chỉ số, nguồn lạ, chưa gắn nguồn, sổ chưa báo giá, không phát sinh → mảng rỗng)

## 2. Route API

- [x] 2.1 Tạo `app/api/customers/sources/route.ts`: `requireAdmin` → validate `isValidDateRange` (400) → 4 query phân trang (`enum_options` kind source, `customers` cohort, `service_ledgers` + embed `customers!inner(source)`, `appointment_upsales` + embed lồng `appointments!inner(customers!inner(source))`) → `calculateSourceStats` → `Response.json({ data, totals, currency, period })`
- [x] 2.2 Nới tham số `optionLabel()` trong `lib/customers.ts` thành `Pick<EnumOption, "label_vi"|"label_en"|"label_id">`

## 3. Biểu đồ tròn trên trang báo cáo

- [x] 3.1 Component `Donut` (SVG thuần, không thêm thư viện): vòng nền, lát `stroke-dasharray` + khe 2 đơn vị, `<title>` tooltip, tâm hiện tổng, legend nhãn + giá trị + %
- [x] 3.2 `formatRupiahCompact` trong `lib/currency.ts` cho tâm donut (số đầy đủ tràn khỏi lỗ 128px)
- [x] 3.3 Section "Nguồn khách hàng" (ô nửa hàng còn trống) với 2 donut Data / Doanh thu, mỗi cái tự sort theo chỉ số của nó; màu lấy `enum_options.color`, fallback `--muted-foreground`
- [x] 3.4 i18n ×3: `sourceSection`, `sourceDataChart`, `sourceRevenueChart`, `unknownSource`, `noSourceStats`

## 4. Kiểm chứng

- [x] 4.1 `node --test lib/financial.test.ts` (11/11) + `npx tsc --noEmit` + eslint + JSON ×3
- [x] 4.2 Chạy trọn 4 query trên dữ liệu thật qua REST: embed lồng 2 tầng OK; tổng doanh thu theo nguồn = tổng theo dịch vụ (6.333.333) — 2 API khớp nhau
- [x] 4.3 Render biểu đồ (bản HTML tĩnh cùng markup) và soi bằng browser ở cả light + dark — geometry, legend, tâm donut không tràn
- [x] 4.4 Palette validator (skill dataviz) trên 7 màu nguồn: CVD + normal-vision PASS
- [x] 4.5 Cập nhật `memory-bank/README.md`
