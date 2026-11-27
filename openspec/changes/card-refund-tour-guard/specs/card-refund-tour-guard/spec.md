# card-refund-tour-guard

## ADDED Requirements

### Requirement: Hoàn thẻ gỡ tour chưa ai nhận
Hoàn cả thẻ SHALL xoá tour dự kiến và xoá mềm tour thật chưa có Master nhận của thẻ. Tour đã có Master nhận SHALL giữ nguyên. Tour thuộc thẻ đã huỷ / hoàn hoặc dòng DV đã hoàn SHALL NOT nhận hay gán Master được.

#### Scenario: Thẻ hoàn còn tour Chờ nhận
- **WHEN** admin hoàn thẻ có 1 tour Chờ nhận
- **THEN** tour đó bị xoá mềm, không còn ở trang Tour

#### Scenario: Gọi thẳng API nhận tour của thẻ đã hoàn
- **WHEN** Master cập nhật `technician_id` cho tour thuộc thẻ đã hoàn
- **THEN** DB raise `card_cancelled`, app báo "Thẻ đã huỷ / hoàn — không nhận tour này được nữa"

### Requirement: Ghim ngày giữ thứ tự bước
Ngày ghim của một bước dự kiến SHALL từ hôm nay trở đi, sau mọi tour thật và bước dự kiến trước nó, và trước bước dự kiến đã ghim kế sau (cùng dòng thẻ).

#### Scenario: Ghim bước 2 sang sau bước 3 đã ghim
- **WHEN** bước 3 ghim 01/03 và người dùng ghim bước 2 sang 05/03
- **THEN** báo "Ngày phải trước bước sau đã ghim (01/03/2027)" và không lưu

### Requirement: Lead-form báo đúng loại trùng
Lỗi trùng (23505) ở lead-form SHALL báo theo ràng buộc bị trùng: lịch hẹn cùng giờ, SĐT, hội thoại SMAX; ràng buộc khác báo câu chung.
