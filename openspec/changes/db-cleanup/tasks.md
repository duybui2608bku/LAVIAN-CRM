## 1. DB

- [x] 1.1 Khảo sát bảng/cột/policy/index thật + advisor, đối chiếu code
- [x] 1.2 Migration `20261112130000_db_cleanup.sql` (drop + index FK + gộp RLS)
- [x] 1.3 Chạy migration (trừ drop `deposit_currency` — chờ deploy code)
- [x] 1.4 Chạy lại advisor performance/security
- [x] 1.5 `20261112140000_harden_functions.sql`: siết EXECUTE function SECURITY DEFINER + search_path `set_updated_at`
- [ ] 1.6 Sau deploy: `alter table public.customers drop column if exists deposit_currency;`

## 2. Code

- [x] 2.1 `/customers` chọn cột tường minh + IG username qua JSON path
- [x] 2.2 `/appointments` chỉ lấy `thread->>link`
- [x] 2.3 Bỏ `deposit_currency`, xoá `uploadImage` chết
- [x] 2.4 tsc + eslint + node test
