## Why

Project trên Vercel (gói Hobby) bị tắt (`402 DEPLOYMENT_DISABLED`) vì vượt hạn mức 30 ngày:
Active CPU 12h/4h, Function Invocations 2M/1M, CDN Requests 2.8M/1M.

Nguyên nhân nhân số request lớn nhất: mọi `<Link>` điều hướng trong `app-shell.tsx` để prefetch mặc định.
Các route `(app)` đều dynamic + có `loading.tsx` → mỗi lần mở 1 trang, Next prefetch ~10 route trong sidebar;
mỗi prefetch = 1 lượt `proxy.ts` (getClaims + query `profiles`) + 1 lượt render layout (`getCurrentProfile`).

Ghi chú: hạn mức Hobby tính chung cả team; project `maplance` (repo khác) chiếm ~97% Fast Data Transfer.
Thay đổi này chỉ giảm phần của LAVIAN — không tự giải quyết việc team bị tắt.

## What Changes

- Tắt prefetch (`prefetch={false}`) cho các link điều hướng trong `components/layout/app-shell.tsx`
  (menu sidebar, logo, thanh tab dưới, menu sheet điện thoại). Chỉ tải route khi người dùng bấm.

Không đổi: `proxy.ts` (vẫn gác quyền mọi request), DB, UI.

## Impact

- Code: `components/layout/app-shell.tsx`.
- Đánh đổi: bấm menu chờ thêm 1 round-trip trước khi thấy skeleton `loading.tsx` (trước đây skeleton đã prefetch sẵn).
