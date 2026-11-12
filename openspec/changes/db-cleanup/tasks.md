## 1. DB

- [x] 1.1 Khảo sát bảng/cột/policy/index thật + advisor, đối chiếu code
- [x] 1.2 Migration `20261112130000_db_cleanup.sql` (drop + index FK + gộp RLS)
- [ ] 1.3 Người dùng chạy migration trên Supabase SQL Editor (sau khi deploy code)
- [ ] 1.4 Chạy lại advisor performance/security

## 2. Code

- [x] 2.1 `/customers` chọn cột tường minh + IG username qua JSON path
- [x] 2.2 `/appointments` chỉ lấy `thread->>link`
- [x] 2.3 Bỏ `deposit_currency`, xoá `uploadImage` chết
- [x] 2.4 tsc + eslint + node test
