## ADDED Requirements

### Requirement: Một kiểu bảng
Mọi bảng dữ liệu trong `app/(app)/` SHALL dùng `DataTable` (`components/common/data-table.tsx`). Trang KHÔNG tự đặt `size`, `bordered`, `className` surface hay format tổng ở phân trang.

#### Scenario: Bảng có phân trang
- **WHEN** bảng có nhiều hơn 1 trang
- **THEN** phân trang hiện "từ–đến trên tổng" giống nhau ở mọi trang

### Requirement: Một kiểu thao tác trên dòng
Thao tác trên một dòng bảng (sửa, xoá, đặt lại mật khẩu, khoá…) SHALL nằm trong `RowActions` (nút 3 chấm, cột cuối). Thao tác nguy hiểm SHALL hỏi lại bằng `useConfirm` (modal giữa màn hình).

#### Scenario: Xoá dịch vụ
- **WHEN** chọn "Xoá" trong menu 3 chấm của một dịch vụ
- **THEN** hiện modal xác nhận với nút đỏ, giống hệt khi xoá khách hàng

### Requirement: Một kiểu form tạo/sửa
Form tạo/sửa bản ghi SHALL mở bằng `FormDrawer` (Drawer bên phải, footer canh phải: Huỷ rồi nút chính). Modal chỉ dùng cho xác nhận hoặc thao tác 1 trường (đặt lại mật khẩu, ghi chú).

#### Scenario: Thêm dịch vụ
- **WHEN** bấm "Thêm dịch vụ"
- **THEN** Drawer phải mở ra, cùng vị trí và nút như "Thêm khách hàng"

### Requirement: Một kiểu card số liệu
Card số liệu SHALL dùng `StatCard` (nhãn nhỏ màu phụ → giá trị `text-2xl font-semibold tabular-nums` → gợi ý tuỳ chọn).

### Requirement: Điều hướng không thừa
Sidebar SHALL chỉ chứa mục có trang thật, chia nhóm Vận hành / Quản trị (nhóm Quản trị chỉ admin). Tài khoản, giao diện sáng/tối, ngôn ngữ, đăng xuất SHALL nằm trong menu tài khoản ở đáy sidebar.

#### Scenario: Sidebar thu gọn
- **WHEN** sidebar thu gọn
- **THEN** chỉ còn icon; menu tài khoản vẫn mở được từ avatar
