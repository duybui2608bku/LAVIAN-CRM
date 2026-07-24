## Why

Khi khách đến làm dịch vụ, kỹ thuật viên cần ghi nhận nhanh phần doanh số bán thêm ngay trên lịch hẹn của ngày hôm đó. Hiện lịch hẹn chưa có dữ liệu con riêng để lưu khoản upsale nên không thể nhập và cộng tổng theo từng lịch.

## What Changes

- Thêm các record upsale con thuộc một lịch hẹn; một lịch hẹn có thể có nhiều record.
- Mỗi record lưu một dịch vụ upsale độc lập, số tiền dương và thông tin audit tối thiểu.
- Hiển thị danh sách, tổng tiền, thao tác thêm và xóa upsale ngay trong khu vực thao tác của lịch hẹn.
- Cộng upsale vào Tổng giá phải thanh toán và công nợ của sổ liệu trình.
- Mọi user đăng nhập đều được ghi upsale khi lịch ở trạng thái `checked_in` hoặc `completed`.
- Cho phép đổi kỹ thuật viên trực tiếp tại cột Kỹ thuật viên trên bảng lịch hẹn.

## Capabilities

### New Capabilities

- `appointment-upsales`: Ghi nhận và quản lý các khoản tiền upsale con của từng lịch hẹn.

### Modified Capabilities

Không có.

## Impact

- Supabase: bảng con mới liên kết `appointments`, `services`, RLS và quyền Data API.
- Luồng lịch hẹn: query nạp thêm upsale, server actions thêm/xóa/đổi kỹ thuật viên, type và helper tính Tổng giá gồm upsale.
- UI `/appointments`: chọn dịch vụ + nhập số tiền upsale, hiển thị tổng theo lịch và sửa KTV inline.
- i18n: nhãn upsale cho ba locale hiện có.
