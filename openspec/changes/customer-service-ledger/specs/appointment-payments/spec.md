# Delta: appointment-payments — sổ tiền dùng chung theo (khách hàng, dịch vụ)

## ADDED Requirements

### Requirement: Sổ tiền theo cặp khách hàng–dịch vụ
Hệ thống SHALL lưu sổ tiền liệu trình trong bảng `public.service_ledgers`: khách hàng (FK cascade), dịch vụ (FK restrict), tổng giá `total_amount` (nullable), `closed_at` (null = đang mở), người tạo, timestamps. Mỗi cặp (khách hàng, dịch vụ) SHALL có tối đa MỘT sổ đang mở (unique partial index). Khi tạo/sửa lịch hẹn, server SHALL tự tìm sổ mở của (khách, dịch vụ) — chưa có thì tạo — và gắn `appointments.ledger_id`; mọi lịch hẹn cùng khách + cùng dịch vụ vì thế dùng chung một sổ (tổng giá và các dòng tiền), sửa từ lịch nào cũng là sửa cùng một sổ.

#### Scenario: Khách cũ đặt lại cùng dịch vụ dùng chung sổ
- **WHEN** khách A có sổ dịch vụ B tổng 500.000 đ đã thu 200.000 đ (lịch 1/1), nhân viên đặt thêm lịch 5/1 cho A cùng dịch vụ B
- **THEN** lịch 5/1 gắn đúng sổ đó — hiện tổng 500.000 đ, Đã thu 200.000 đ, Còn nợ 300.000 đ

#### Scenario: Sửa tổng giá từ lịch nào cũng đồng bộ
- **WHEN** nhân viên sửa Tổng giá thành 600.000 đ từ drawer của lịch 1/1
- **THEN** lịch 5/1 (chung sổ) hiển thị tổng 600.000 đ — không phải sửa 2 nơi

#### Scenario: Dịch vụ khác thì sổ mới
- **WHEN** khách A đang có sổ dịch vụ B, đặt lịch mới với dịch vụ C
- **THEN** hệ thống tạo sổ mới (A, C) trống — tiền dịch vụ B không lẫn sang

### Requirement: Tất toán và mở lại sổ
Sổ SHALL đóng được thủ công (set `closed_at`) và mở lại được (xóa `closed_at`, bị từ chối nếu đã có sổ mở khác cùng cặp). Sổ đã đóng: server SHALL từ chối thêm dòng tiền; lịch hẹn mới cùng (khách, dịch vụ) SHALL mở sổ MỚI tính từ đầu. Dialog Thanh toán SHALL có nút Tất toán / Mở lại và badge trạng thái sổ.

#### Scenario: Mua lại dịch vụ sau khi tất toán
- **WHEN** sổ (A, B) đã bấm Tất toán, sau đó nhân viên đặt lịch mới cho A dịch vụ B
- **THEN** lịch mới gắn sổ MỚI (tổng giá trống, Đã thu 0); sổ cũ giữ nguyên lịch sử

#### Scenario: Chặn thu tiền vào sổ đã đóng
- **WHEN** người dùng thêm dòng thu vào sổ có `closed_at`
- **THEN** server từ chối kèm thông báo sổ đã tất toán

## MODIFIED Requirements

### Requirement: Sổ thanh toán theo lịch hẹn
Hệ thống SHALL lưu mỗi lần tiền vào/ra thành một dòng bảng `public.appointment_payments` THUỘC MỘT SỔ (`ledger_id` FK `service_ledgers`, cascade): loại (`deposit|payment|refund` — check constraint), số tiền dương (> 0), phương thức (`bank|cash|card`, nullable), ảnh chứng từ (nullable), ghi chú, thời điểm thu `paid_at` (default now), người tạo `created_by`. `appointment_id` SHALL giữ lại làm dấu vết buổi thu (nullable, on delete set null — xóa lịch hẹn không làm mất tiền của liệu trình). Dòng sổ SHALL là bất biến — không có thao tác sửa; sửa sai bằng xóa dòng + thêm lại, hoàn tiền thật bằng dòng `refund`.

#### Scenario: Ghi nhận cọc khi tạo lịch
- **WHEN** người dùng tạo lịch hẹn nhập Cọc 500.000 đ
- **THEN** lịch hẹn được tạo, sổ của (khách, dịch vụ) có 1 dòng `deposit` 500.000 đ gắn cả `ledger_id` lẫn `appointment_id` của lịch vừa tạo

#### Scenario: Xóa lịch hẹn không mất tiền
- **WHEN** một lịch hẹn có dòng cọc trong sổ bị xóa
- **THEN** dòng cọc vẫn nằm trong sổ (Đã thu của liệu trình không đổi), chỉ mất liên kết buổi thu

#### Scenario: Hoàn cọc không mất dấu vết
- **WHEN** khách được hoàn cọc 500.000 đ
- **THEN** sổ thêm dòng `refund` 500.000 đ; dòng `deposit` cũ giữ nguyên; Đã thu ròng = 0

### Requirement: Đã thu và Còn nợ tính từ sổ
"Đã thu" SHALL bằng `Σ(deposit + payment) − Σ(refund)` các dòng CỦA SỔ (mọi buổi hẹn của liệu trình); "Còn nợ" SHALL bằng `(total_amount ?? 0) − Đã thu`, không âm. Các cột tiền per lịch hẹn (`expected_amount`, `final_amount`) bị loại bỏ — tổng giá chỉ còn `service_ledgers.total_amount`. Lịch hẹn chưa có sổ (dữ liệu cũ không dịch vụ) SHALL hiển thị fallback Σ dòng tiền theo `appointment_id`.

#### Scenario: Còn nợ tính chung mọi buổi
- **WHEN** sổ tổng 2.000.000 đ có deposit 500.000 đ (buổi 1) + payment 1.000.000 đ (buổi 2)
- **THEN** mọi lịch hẹn của sổ đều hiện Đã thu = 1.500.000 đ, Còn nợ = 500.000 đ

### Requirement: Dialog Thanh toán của lịch hẹn
Mỗi lịch hẹn SHALL mở được dialog Thanh toán hiển thị SỔ nó thuộc về (title kèm tên dịch vụ): liệt kê dòng tiền của mọi buổi hẹn trong liệu trình (thời điểm, loại, số tiền, phương thức, ảnh thumbnail, ghi chú, người tạo) mới nhất trước, dòng tổng Đã thu / Còn nợ theo sổ; form thêm dòng (ẩn khi sổ đã đóng); xóa dòng có xác nhận; nút Tất toán / Mở lại. Lịch hẹn chưa có sổ SHALL hiện gợi ý chọn dịch vụ để mở sổ.

#### Scenario: Thu tiền từ buổi thứ hai
- **WHEN** người dùng mở dialog Thanh toán từ lịch 5/1 (chung sổ với lịch 1/1) và thêm dòng thu 300.000 đ
- **THEN** dòng ghi vào sổ chung với dấu vết buổi 5/1; mở dialog từ lịch 1/1 cũng thấy dòng này

### Requirement: Tổng đã trả theo khách hàng
Dialog lịch sử lịch hẹn của khách ở `/customers` SHALL hiển thị Đã thu theo sổ của từng lịch và dòng "Tổng đã trả" = Σ Đã thu của các SỔ KHÁC NHAU của khách (dedupe theo sổ — nhiều lịch chung sổ không được cộng trùng) cộng các dòng tiền chưa gắn sổ.

#### Scenario: Hai lịch chung sổ không đếm trùng
- **WHEN** khách có 2 lịch cùng sổ dịch vụ B (Đã thu 500.000 đ) và 1 lịch sổ dịch vụ C (Đã thu 300.000 đ)
- **THEN** "Tổng đã trả" = 800.000 đ (không phải 1.300.000 đ)

### Requirement: Thu tiền khi hoàn tất lịch hẹn
Popover Hoàn tất SHALL nhập: Tổng giá liệu trình (update `service_ledgers.total_amount` — thay cho "doanh số chốt" per lịch), số tiền thu lần này (prefill = tổng − Đã thu của sổ), phương thức, ảnh chứng từ. Xác nhận SHALL chuyển lịch sang `completed` và (nếu số thu > 0) ghi 1 dòng `payment` vào sổ trong cùng một server action.

#### Scenario: Hoàn tất buổi cuối thu nốt phần còn lại
- **WHEN** sổ tổng 2.000.000 đ đã thu 1.500.000 đ, người dùng hoàn tất lịch và thu 500.000 đ
- **THEN** status → `completed`, sổ thêm dòng `payment` 500.000 đ, Còn nợ = 0
