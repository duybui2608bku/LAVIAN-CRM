## Why

Sếp muốn chốt thẻ xong là **tour cả lộ trình tự hiện ra**, không phải nhớ để tạo từng tour. Ví dụ khách chốt Mày + Laser (dự kiến 2 buổi): Laser 1 (ngày 1) → Laser 2 (+20 ngày) → Làm mới (+20 ngày) → Dặm (+45 ngày) = 4 tour.

Khó ở chỗ **lúc bán chưa biết chắc cần mấy buổi laser**. Vì vậy lộ trình phải là **dự kiến** và **tự tính lại** khi thực tế khác (laser sạch sớm, hoặc cần thêm buổi).

Hiện tại chỉ có danh sách "Đến hạn" (tự tính, không có tour), tour vẫn phải tạo tay từng cái.

## What Changes

- **Tour dự kiến** (`tours.planned = true`): hệ thống tự sinh các tour còn lại của lộ trình **mày** (nhóm Laser + nhóm Alis trong cùng thẻ) sau tour thật gần nhất:
  - Sau Laser → 20 ngày (Laser tiếp hoặc Làm mới). Sau Làm mới / Dặm → 45 ngày.
  - Số tour Laser dự kiến = **số buổi Laser trong thẻ** − số tour Laser đã có. Số tour mày = số buổi Alis (2 buổi = Làm mới + Dặm 1).
  - Ngày mỗi tour tính từ tour đứng trước → tour trước dời thì cả chuỗi dời theo.
- **Tự tính lại**: mỗi khi tour / thẻ của lộ trình thay đổi (tạo tour, dời ngày, đổi Loại, xoá tour, sửa số buổi, hoàn DV, chốt lịch), các tour dự kiến được sinh lại (sửa tại chỗ, thêm / xoá mềm phần thừa). Tour thật không bao giờ bị đụng.
- **Chốt lịch**: tour dự kiến không vào "Chờ nhận" của KTV, không xác nhận / gán KTV được. CSKH / Sales gọi khách xong bấm **Chốt lịch** (chọn lại ngày nếu cần) → thành tour thật, vào Chờ nhận như cũ; các tour dự kiến sau dời theo.
- **Kết quả laser** ở drawer thẻ (cạnh dòng Laser, khi tour cuối của vùng mày là Laser): **"Sạch → lên mới"** (số buổi Laser = số đã làm) / **"Còn mực +1 buổi"** (số buổi Laser + 1). Dùng lại sửa số buổi có sẵn → lộ trình tự tính lại.
- Tour dự kiến **không tính** là buổi đã dùng, không vào Đến hạn, Excel, phiếu tour, công Master.
- Chỉ làm vùng **mày** trước; môi / mí giữ cách cũ (Đến hạn), cấu trúc để mở rộng sau.

## Capabilities

### New Capabilities
- `tour-roadmap`: Tour dự kiến của lộ trình mày, tự tính lại, chốt lịch, kết quả laser.

### Modified Capabilities
<!-- treatment-journey (Đến hạn) chưa archive vào openspec/specs; chỉ đổi đầu vào: bỏ tour dự kiến. -->

## Impact

- **DB** (`20261123140000_tour_roadmap_planned.sql`): cột `tours.planned`, check (dự kiến thì chưa KTV / chưa xác nhận); RLS `tours_update` cho `cards.edit` sửa tour dự kiến; RPC `journey_due_source` bỏ tour dự kiến.
- **Code**: `lib/cards{,.test}.ts` (`planRoadmap`), `lib/roadmap-sync.ts` (mới, server), `app/(app)/cards/actions.ts`, `app/(app)/tour/{actions,page}.ts(x)`, `lib/tours.ts` (trạng thái Dự kiến), `types/tour.ts`, `components/tour/{tour-view,tour-drawer}.tsx`, `components/cards/card-drawer.tsx`, `messages/{vi,en}.json`.
- Không đổi tiền thẻ / công Master (tour dự kiến không có KTV, không xác nhận).
