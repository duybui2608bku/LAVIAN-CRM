## ADDED Requirements

### Requirement: Mã thẻ theo dịch vụ chính
Mã thẻ SHALL là tiền tố dịch vụ chính + số thứ tự chung ít nhất 4 chữ số, đặt 1 lần khi tạo thẻ.

#### Scenario: Thẻ mày + laser
- **WHEN** bán thẻ gồm Laser 1.000.000 và Alis 4.000.000, số thứ tự 13
- **THEN** mã thẻ là `ALIS0013`

#### Scenario: Thẻ môi
- **WHEN** bán thẻ gồm Laser 1.000.000 và Bibir 11.000.000, số thứ tự 14
- **THEN** mã thẻ là `BIBIR0014`

### Requirement: Xoá dịch vụ khỏi thẻ
Người có quyền `cards.edit` SHALL xoá được 1 DV của thẻ còn hiệu lực khi DV chưa có tour thật và thẻ còn DV khác; thao tác ghi vào nhật ký thẻ.

#### Scenario: DV đã có tour
- **WHEN** xoá DV đã có tour thật chưa xoá
- **THEN** hệ thống từ chối và báo xoá tour trước

### Requirement: Hoàn cả thẻ
Người có quyền `cards.edit` SHALL hoàn được thẻ còn hiệu lực với số tiền từ 0 tới số đã thu; thẻ chuyển Đã hoàn, khoá mọi thao tác, công nợ 0.

#### Scenario: Hoàn một phần
- **WHEN** thẻ đã thu 6.000.000, hoàn 3.000.000
- **THEN** Đã thu = 3.000.000, Giá trị thẻ = 3.000.000, Công nợ = 0, báo cáo ngày hoàn ghi −3.000.000

### Requirement: Sửa số buổi tại chỗ
Drawer thẻ SHALL cho nhấp đúp vào số buổi để sửa trực tiếp, Enter / rời ô lưu, Esc huỷ.
