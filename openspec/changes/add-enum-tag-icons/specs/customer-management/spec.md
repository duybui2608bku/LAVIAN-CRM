# Spec delta: customer-management

## ADDED Requirements

### Requirement: Hiển thị Giai đoạn và Nguồn dưới dạng tag
Bảng `/customers` SHALL hiển thị cột Giai đoạn (stage) và Nguồn (source) bằng tag: nhãn theo locale + icon + màu đã cấu hình trong `enum_options`. Option chưa có màu SHALL fallback về badge trung tính như hiện tại; giá trị không còn option tương ứng hiển thị value thô trong badge.

#### Scenario: Stage có icon + màu
- **WHEN** option stage "deposited" có `icon='piggy-bank'`, `color='#22c55e'` và khách hàng ở stage đó
- **THEN** ô Giai đoạn hiển thị tag nền xanh nhạt, chữ + icon xanh `#22c55e`, nhãn "Đã đặt cọc" (locale vi)

#### Scenario: Source chưa cấu hình màu
- **WHEN** option source "other" có `color` null
- **THEN** ô Nguồn hiển thị badge secondary với nhãn theo locale, không icon
