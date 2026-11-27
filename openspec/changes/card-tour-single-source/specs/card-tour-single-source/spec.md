# card-tour-single-source

## ADDED Requirements

### Requirement: Huỷ thẻ xoá tour chưa ai nhận
Admin huỷ thẻ chưa có tiền thu SHALL xoá mềm mọi tour chưa có Master nhận của thẻ, gồm tour dự kiến và tour Chờ nhận. Thẻ có tour đã có Master nhận SHALL NOT huỷ được.

#### Scenario: Thẻ chỉ có tour dự kiến
- **WHEN** admin huỷ thẻ có lộ trình dự kiến, chưa thu tiền
- **THEN** thẻ bị huỷ và các tour dự kiến bị xoá

#### Scenario: Đã có Master nhận
- **WHEN** thẻ có 1 tour đã có Master nhận
- **THEN** báo "Thẻ đã có tour Master nhận — không huỷ được, dùng Hoàn thẻ" và không xoá tour nào

### Requirement: Thẻ Mày hoặc thẻ Môi
Một thẻ SHALL NOT có cùng lúc DV tạo tour thuộc vùng Mày (nhóm alis, laser) và DV tạo tour thuộc vùng Môi (nhóm bibir, lips_treatment). Quy tắc này không áp cho mực, phí Master, mí.

#### Scenario: Bán thêm môi vào thẻ mày
- **WHEN** thẻ đang có Ombre (alis) và Sales chọn Nano Lip (bibir)
- **THEN** Nano Lip bị khoá trong drawer; server và DB đều chặn với lỗi `card_area_taken`

### Requirement: Hoá đơn tour theo giá trọn gói
Ở trang Tour, Hoá đơn SHALL chỉ ghi giá dòng thẻ ở tour thật đầu tiên của dòng đó. Các buổi sau hiện "—". Công Master SHALL tính trên giá cả dòng.

#### Scenario: Mày 500, 2 buổi
- **WHEN** dòng Ombre giá 500 có tour Làm mới (tháng 11) và Dặm (tháng 1)
- **THEN** tháng 11 có Hoá đơn 500 và công 35; tháng 1 có Hoá đơn "—" và công 15

### Requirement: Một nguồn cho Master, Huỷ / Đổi lịch, KPI, cọc
- Master của khách SHALL là Master của tour thật gần nhất. Lịch hẹn SHALL tự điền Master từ tour cùng khách, cùng ngày.
- Huỷ / Đổi lịch SHALL lưu ở `visit_status`; `booking_confirm` chỉ còn `pending` / `confirmed`.
- `/reports`, Báo cáo Telesales và pipeline `/customers` SHALL dùng chung định nghĩa ở `lib/kpi.ts`.
- `customers.deposit_amount` SHALL NOT nhỏ hơn tổng phần cọc đã trừ vào các thẻ chưa huỷ.

#### Scenario: Telesales huỷ lịch
- **WHEN** Telesales chọn "Khách huỷ" ở trang Đặt lịch cho lịch chưa đến
- **THEN** `visit_status` = cancelled, Quản lý bán hàng và Báo cáo Telesales cùng tính lịch đó là huỷ

#### Scenario: Trả tour
- **WHEN** Master A trả tour, rồi Master B nhận tour đó (lịch cùng ngày chưa thực hiện)
- **THEN** lịch hẹn hiện Master B
