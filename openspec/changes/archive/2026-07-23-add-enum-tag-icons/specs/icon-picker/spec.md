# Spec: icon-picker

## ADDED Requirements

### Requirement: Tìm kiếm và chọn icon Lucide
Component `IconPicker` SHALL cho phép người dùng tìm icon Lucide theo tên (substring, không phân biệt hoa thường) trên toàn bộ danh sách `iconNames` của `lucide-react/dynamic`, và trả về tên icon (kebab-case) qua `onChange`.

#### Scenario: Tìm và chọn icon
- **WHEN** người dùng mở picker, gõ "phone" và bấm một icon trong lưới kết quả
- **THEN** `onChange` được gọi với tên icon đã chọn (vd. `"phone-call"`), trigger hiển thị icon đó, popover đóng

#### Scenario: Giới hạn kết quả render
- **WHEN** từ khóa khớp nhiều hơn 96 icon
- **THEN** chỉ 96 icon đầu được render kèm bộ đếm "hiển thị x/y" để người dùng thu hẹp từ khóa

### Requirement: Bỏ chọn icon
Component SHALL cho phép xóa icon đã chọn (trả về chuỗi rỗng / null) vì icon là tùy chọn.

#### Scenario: Xóa icon đang chọn
- **WHEN** đang có icon được chọn và người dùng bấm nút bỏ chọn
- **THEN** `onChange` được gọi với giá trị rỗng và trigger quay về trạng thái chưa chọn
