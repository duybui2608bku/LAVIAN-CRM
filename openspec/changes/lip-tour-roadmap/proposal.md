## Why

Lộ trình tour dự kiến mới có cho **mày** (`brow-tour-roadmap`). Sếp chốt lộ trình **môi** (2026-11-27):
- Môi làm mới luôn → sau **2 tháng** dặm.
- Môi xoá sửa: Hút dung dịch / CO2 (DV "Lip Spray Removal (plasma)", Loại Plasma) → hẹn **2 tháng** làm mới → sau **2 tháng** dặm.
- Công Master: Dặm 3%, Làm mới 7% (đúng như `TOUR_RATES` hiện tại, không đổi).

## What Changes

- Bật vùng **môi** (`bibir`) cho `planRoadmap`: DV chính = nhóm `bibir` (Nano Lip, Ombre Effect…), bước xoá = dòng DV xoá môi (tên có "plasma", nhóm `lips_treatment`) → Loại **Plasma**.
- Khoảng cách theo vùng: mày giữ 20 ngày (sau Laser) / 45 ngày (sau Làm mới, Dặm); môi **60 ngày** cho mọi bước (sau Plasma, Làm mới, Dặm). "2 tháng" quy ước = 60 ngày (ponytail: cùng cách cộng ngày như mày).
- Danh sách **Đến hạn** (`journeyDue`) dùng cùng khoảng cách theo vùng → môi nhắc kiểm tra plasma / dặm sau 60 ngày.
- Lộ trình chưa có tour thật: ngày bắt đầu tính **riêng từng vùng** (tour dự kiến sớm nhất của vùng đó), sửa ngày bước đầu của mày không kéo theo môi.
- DV khác của nhóm `lips_treatment` (Dark Lip Treatment, Collagen Stem Cell) không thuộc lộ trình — giữ cách cũ.

## Capabilities

### Modified Capabilities
- `tour-roadmap`: thêm vùng môi, khoảng cách theo vùng.

## Impact

- **Code**: `lib/cards.ts` (`ROADMAP_AREAS`, cấu hình khoảng cách theo vùng, `planRoadmap`, `journeyDue`) + test; `lib/roadmap-sync.ts` (lấy tên DV, start theo vùng); `components/cards/card-items-drawer.tsx` (truyền tên DV cho xem trước).
- **DB**: không đổi (dùng cột `tours.planned` / `date_pinned` có sẵn). Thẻ môi cũ chưa có tour dự kiến sẽ có khi tour / thẻ đó được sửa lần tới.
- Nút "Sạch → lên mới / Còn mực +1 buổi" vẫn chỉ cho laser mày; số buổi plasma sửa bằng nhấp đúp số buổi như cũ.
