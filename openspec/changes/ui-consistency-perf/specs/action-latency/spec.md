## ADDED Requirements

### Requirement: Một round-trip cho mỗi thao tác ghi
Sau khi một Server Action đã gọi `revalidatePath` đúng route đang xem, client SHALL KHÔNG gọi thêm `router.refresh()`. Mỗi thao tác ghi SHALL tốn đúng **một** lượt gọi server.

#### Scenario: Sửa nhanh một ô trên bảng khách hàng
- **WHEN** đổi Giai đoạn của một khách bằng select inline
- **THEN** chỉ có một request tới server; bảng cập nhật từ payload trả về của chính action đó

#### Scenario: Danh mục enum
- **WHEN** thêm/sửa/xoá một option ở `/enums/[kind]`
- **THEN** action gọi `revalidatePath("/enums/[kind]", "page")` và bảng cập nhật mà không cần `router.refresh()`

### Requirement: Phản hồi tức thì khi điều hướng
Mỗi route trong `app/(app)/` SHALL có `loading.tsx` hiện khung xương (skeleton) đúng bố cục trang. Người dùng SHALL thấy khung trang ngay khi bấm điều hướng, không chờ query server xong.

#### Scenario: Bấm vào Khách hàng từ sidebar
- **WHEN** bấm mục Khách hàng trong sidebar
- **THEN** khung trang (tiêu đề + thanh lọc + bảng xương) hiện ngay, dữ liệu đổ vào sau

### Requirement: Sửa inline không khoá bảng
Khi lưu một ô sửa inline, giao diện SHALL cập nhật giá trị ô đó ngay (optimistic) và SHALL KHÔNG vô hiệu hoá các dòng còn lại. Nếu action lỗi, giá trị SHALL trở về như cũ kèm thông báo lỗi.

#### Scenario: Đổi kỹ thuật viên của một dòng
- **WHEN** chọn kỹ thuật viên mới cho một lịch hẹn
- **THEN** ô đó đổi ngay sang giá trị mới; các dòng khác vẫn bấm/sửa được trong lúc chờ

#### Scenario: Action lỗi
- **WHEN** server trả lỗi cho thao tác sửa inline
- **THEN** ô trở lại giá trị cũ và hiện toast lỗi

### Requirement: Phân trang cho bảng lịch hẹn
`/appointments` SHALL phân trang 20 dòng mỗi trang như `/customers`, kể cả khi bảng đang gom nhóm theo trạng thái.

#### Scenario: Nhiều lịch hẹn trong ngày
- **WHEN** bộ lọc trả về hơn 20 lịch hẹn
- **THEN** bảng chỉ render 20 dòng, kèm thanh phân trang cùng kiểu `/customers`
