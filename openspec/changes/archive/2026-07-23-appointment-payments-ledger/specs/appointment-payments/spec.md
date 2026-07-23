# Spec: appointment-payments — sổ thanh toán lịch hẹn

## ADDED Requirements

### Requirement: Sổ thanh toán theo lịch hẹn
Hệ thống SHALL lưu mỗi lần tiền vào/ra của một lịch hẹn thành một dòng bảng `public.appointment_payments`: loại (`deposit|payment|refund` — check constraint), số tiền dương (> 0), phương thức (`bank|cash|card`, nullable), ảnh chứng từ (public URL bucket `images`, nullable), ghi chú, thời điểm thu `paid_at` (default now), người tạo `created_by`. Dòng sổ SHALL là bất biến — không có thao tác sửa; sửa sai bằng xóa dòng + thêm lại, hoàn tiền thật bằng dòng `refund`.

#### Scenario: Ghi nhận cọc khi tạo lịch
- **WHEN** người dùng tạo lịch hẹn nhập Cọc 500.000 đ kèm ảnh bill
- **THEN** lịch hẹn được tạo và sổ có 1 dòng `deposit` 500.000 đ, ảnh, `created_by` = user hiện tại

#### Scenario: Hoàn cọc không mất dấu vết
- **WHEN** khách được hoàn cọc 500.000 đ
- **THEN** sổ thêm dòng `refund` 500.000 đ; dòng `deposit` cũ giữ nguyên; Đã thu ròng = 0

#### Scenario: Số tiền không hợp lệ
- **WHEN** gửi dòng sổ có amount ≤ 0
- **THEN** server từ chối (validate + check constraint), không có dòng nào được ghi

### Requirement: Đã thu và Còn nợ tính từ sổ
"Đã thu" của một lịch hẹn SHALL bằng `Σ(deposit + payment) − Σ(refund)`; "Còn nợ" SHALL bằng `(final_amount ?? expected_amount ?? 0) − Đã thu`, không âm. Cột tĩnh `appointments.deposit_amount` bị loại bỏ.

#### Scenario: Còn nợ sau khi thu nhiều lần
- **WHEN** lịch có final 2.000.000 đ, sổ có deposit 500.000 đ + payment 1.000.000 đ
- **THEN** Đã thu = 1.500.000 đ, Còn nợ = 500.000 đ

### Requirement: Dialog Thanh toán của lịch hẹn
Mỗi lịch hẹn SHALL mở được dialog Thanh toán từ `/appointments` (nút ở cột thao tác và trong drawer sửa): liệt kê các dòng sổ (thời điểm, loại, số tiền, phương thức, ảnh thumbnail bấm mở tab mới, ghi chú, người tạo) mới nhất trước, kèm dòng tổng Đã thu / Còn nợ; form thêm dòng (loại thu/hoàn, số tiền, phương thức, ảnh qua `ImageUpload`, ghi chú); xóa dòng có xác nhận AlertDialog.

#### Scenario: Thêm lần thu kèm ảnh
- **WHEN** người dùng mở dialog Thanh toán, nhập 1.000.000 đ, chọn chuyển khoản, tải ảnh bill, bấm thêm
- **THEN** dòng mới hiện đầu danh sách kèm thumbnail; Đã thu và Còn nợ cập nhật

#### Scenario: Xóa dòng ghi nhầm
- **WHEN** người dùng bấm xóa một dòng và xác nhận
- **THEN** dòng biến mất, tổng tính lại; ảnh chứng từ (nếu có) được dọn best-effort khỏi storage

### Requirement: Tổng đã trả theo khách hàng
Dialog lịch sử lịch hẹn của khách ở `/customers` SHALL hiển thị Đã thu của từng lịch và dòng "Tổng đã trả" = Σ Đã thu qua mọi lịch hẹn (chưa xóa) của khách đó.

#### Scenario: Khách làm dịch vụ 2 lần
- **WHEN** khách có 2 lịch completed, sổ lần lượt thu ròng 2.000.000 đ và 3.000.000 đ
- **THEN** dialog lịch sử hiện tổng đã trả 5.000.000 đ

### Requirement: Thu tiền khi hoàn tất lịch hẹn
Popover Hoàn tất SHALL nhập: doanh số chốt (`final_amount`), số tiền thu lần này (prefill = final − Đã thu), phương thức, ảnh chứng từ. Xác nhận SHALL chuyển lịch sang `completed` và (nếu số thu > 0) ghi 1 dòng `payment` kèm ảnh trong cùng một server action.

#### Scenario: Hoàn tất kèm thu phần còn lại
- **WHEN** lịch checked_in có deposit 500.000 đ, người dùng hoàn tất với final 2.000.000 đ, thu 1.500.000 đ chuyển khoản kèm ảnh
- **THEN** status → `completed`, sổ thêm dòng `payment` 1.500.000 đ có ảnh, Còn nợ = 0
