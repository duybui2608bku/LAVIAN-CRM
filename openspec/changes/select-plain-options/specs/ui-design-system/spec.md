## ADDED Requirements

### Requirement: Option select là chữ trần
Danh sách lựa chọn của mọi Select (ô lọc trên toolbar, select sửa inline trên bảng, select trong form) SHALL hiển thị nhãn dạng chữ trần — không tag, không nền/viền màu. Tag màu SHALL chỉ dùng ở phần hiển thị giá trị đã chọn trong ô bảng.

#### Scenario: Mở ô lọc trạng thái
- **WHEN** người dùng mở ô lọc "Tất cả trạng thái"
- **THEN** các lựa chọn là chữ thường cùng màu chữ chính, lựa chọn đang chọn được tô theo kiểu mặc định của Select

#### Scenario: Sửa trạng thái ngay trên bảng
- **WHEN** người dùng bấm vào tag trạng thái trong ô bảng để đổi
- **THEN** dropdown liệt kê nhãn chữ trần; sau khi chọn, ô bảng hiện lại tag màu của giá trị mới

### Requirement: Mỗi ô bảng tối đa một tag
Một ô bảng SHALL có tối đa một tag màu (giá trị chính). Thông tin phụ trong ô (stage phụ, trạng thái hạn follow-up, số lần follow-up) SHALL hiển thị bằng chữ cỡ `text-xs`, màu nhạt hoặc màu ngữ nghĩa (`--destructive` quá hạn, `--warning` hôm nay).

#### Scenario: Khách Cân nhắc quá hạn follow-up
- **WHEN** khách stage Cân nhắc có giờ liên hệ lại đã qua
- **THEN** ô Status có 1 tag trạng thái + dòng chữ nhạt "Cân nhắc · n follow-up"; ô Liên hệ lại có giờ + chữ đỏ "Quá hạn"
