# enum-management (delta)

## ADDED Requirements

### Requirement: Trang danh mục tách theo kind
Hệ thống SHALL phục vụ mỗi kind danh mục ở một trang con riêng `/enums/<kind>` (`stage` | `source` | `lost_reason`); kind không hợp lệ trả 404; `/enums` SHALL redirect về `/enums/stage`. Mỗi trang chỉ hiển thị bảng CRUD của kind đó (giữ nguyên hành vi CRUD hiện có).

#### Scenario: Mở trang một kind
- **WHEN** admin mở `/enums/source`
- **THEN** chỉ thấy bảng danh mục Nguồn với đầy đủ thêm/sửa/xóa/toggle

#### Scenario: Kind không hợp lệ
- **WHEN** admin mở `/enums/foo`
- **THEN** nhận trang 404

#### Scenario: URL cũ
- **WHEN** admin mở `/enums`
- **THEN** được redirect về `/enums/stage`

### Requirement: Nhãn En/Id không bắt buộc
`enum_options.label_en`/`label_id` SHALL cho phép NULL; dialog thêm/sửa chỉ bắt buộc nhãn tiếng Việt. Nơi hiển thị theo locale SHALL fallback về nhãn tiếng Việt khi bản dịch trống; bảng /enums hiển thị "—" ở cột thiếu bản dịch.

#### Scenario: Tạo giá trị chỉ có tiếng Việt
- **WHEN** admin thêm giá trị chỉ nhập nhãn tiếng Việt
- **THEN** lưu thành công; cột En/Id hiện "—"; user ở locale en/id vẫn thấy nhãn tiếng Việt (fallback)

### Requirement: Submenu Danh mục ở sidebar
Sidebar (admin) SHALL hiển thị mục cha "Danh mục" với 3 menu con Giai đoạn / Nguồn / Lý do mất khách trỏ tới trang kind tương ứng; menu con active theo path hiện tại; khi sidebar thu gọn icon, mục cha vẫn điều hướng được (về `/enums/stage`).

#### Scenario: Điều hướng bằng menu con
- **WHEN** admin bấm menu con "Nguồn"
- **THEN** điều hướng tới `/enums/source` và menu con đó highlight active
