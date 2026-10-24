## MODIFIED Requirements

### Requirement: Một thư viện UI duy nhất
App SHALL dựng mọi control/overlay/bảng/form bằng Ant Design 6; KHÔNG còn primitive tự viết trong `components/ui/`. Tailwind chỉ dùng cho bố cục (flex/grid/gap/spacing).

#### Scenario: Thêm màn hình mới
- **WHEN** dev cần nút, input, select, bảng, modal, drawer, date picker
- **THEN** dùng component antd hoặc wrapper trong `components/common/` — không cài thêm thư viện UI khác

### Requirement: Theme đồng bộ sáng/tối
`ConfigProvider` SHALL lấy token từ bảng màu dự án và đổi `darkAlgorithm` theo theme `next-themes`.

#### Scenario: Bật dark mode
- **WHEN** người dùng bấm ThemeToggle
- **THEN** mọi component antd (kể cả popup, message) đổi sang nền tối ngay

### Requirement: Xác nhận thao tác nguy hiểm
Xoá / đăng xuất / cấm user SHALL hỏi xác nhận bằng `Popconfirm` hoặc `Modal.confirm` của antd; cấm `window.confirm()`.

#### Scenario: Xoá dịch vụ
- **WHEN** admin bấm xoá
- **THEN** hiện Popconfirm, chỉ gọi server action khi bấm xác nhận
