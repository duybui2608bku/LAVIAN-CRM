## 1. Logic

- [x] 1.1 `lib/cards.ts`: khoảng cách theo vùng (mày 20/45, môi 60/60), `ROADMAP_AREAS = ["alis", "bibir"]`, bước xoá theo Loại gợi ý (laser / plasma), `journeyDue` dùng khoảng cách theo vùng, `start` theo vùng
- [x] 1.2 Test kịch bản spec (`lib/cards.test.ts`)
- [x] 1.3 `lib/roadmap-sync.ts`: lấy `services.name`, start = tour dự kiến sớm nhất của vùng
- [x] 1.4 `card-items-drawer.tsx`: truyền tên DV vào xem trước lộ trình

## 2. Kiểm tra

- [x] 2.1 tsc + eslint + `node --test lib/*.test.ts`
