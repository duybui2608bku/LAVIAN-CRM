## 1. Thẻ và tour

- [x] 1.1 `cancelCard`: chặn khi có tour đã có Master nhận; xoá mềm tour chưa ai nhận (gồm tour dự kiến) rồi huỷ thẻ
- [x] 1.2 Vùng chính: `cardArea` / `areaTaken` (`lib/cards.ts`) + khoá DV khác vùng trong `card-items-drawer` + trigger `card_area_taken` + i18n
- [x] 1.3 Hoá đơn trang Tour = tour thật đầu tiên của dòng thẻ (`billOf` / `firstTourIds`), áp cho tổng trang, tổng Master, Excel, phiếu in

## 2. Gom về một nguồn

- [x] 2.1 Master: bỏ `customers.technician_id` ở code; 360° và drawer thông tin khách hiện Master của tour gần nhất; viết lại trigger điền Master cho lịch hẹn
- [x] 2.2 Huỷ / Đổi lịch: `confirmStatus` / `confirmPatch` + server ghi vào `visit_status`; UI Đặt lịch, Quản lý bán hàng, drawer, Báo cáo Telesales
- [x] 2.3 `lib/kpi.ts` + `/reports` (Đặt lịch theo lịch tạo, Đặt cọc theo tiền cọc) + pipeline `/customers` + Báo cáo Telesales
- [x] 2.4 Tiền cọc: trigger `deposit_below_used` + báo lỗi dễ hiểu ở lead-form + 360° hiện cọc đã trừ / còn lại
- [x] 2.5 Migration `20261127120000_card_tour_single_source.sql` (chạy SAU khi deploy code)

## 3. Kiểm tra

- [x] 3.1 tsc + eslint + `node --test`
- [x] 3.2 Rà ponytail
- [x] 3.3 Chạy migration trên DB (người dùng cho phép) và kiểm tra
- [ ] 3.4 Xem trên trình duyệt
