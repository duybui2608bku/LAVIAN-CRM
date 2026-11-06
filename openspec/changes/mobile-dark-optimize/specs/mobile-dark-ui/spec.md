## ADDED Requirements

### Requirement: Dark mode không nháy sáng
Khi người dùng đã từng dùng giao diện tối, trang SHALL render component antd ở theme tối ngay từ HTML server (không nháy nền/control sáng khi tải lại).

#### Scenario: Tải lại trang ở dark mode
- **WHEN** người dùng đang ở dark mode và tải lại `/tour`
- **THEN** bảng, input, nút hiển thị màu tối ngay khi trang hiện, không có khung hình sáng

#### Scenario: Thanh trạng thái điện thoại
- **WHEN** mở app trên điện thoại ở dark mode hệ thống
- **THEN** thanh trạng thái/thanh địa chỉ dùng màu nền tối của app

### Requirement: Thao tác cảm ứng trên điện thoại
Trên thiết bị cảm ứng, control (nút, ô nhập, select) SHALL cao tối thiểu 40px và ô nhập SHALL có chữ ≥ 16px để iOS không tự phóng to.

#### Scenario: KTV điền chi tiết tour trên iPhone
- **WHEN** KTV chạm vào ô Bill trong drawer tour
- **THEN** trang không tự zoom, bàn phím số hiện ra

#### Scenario: Drawer trên màn hình 375px
- **WHEN** KTV mở chi tiết tour trên điện thoại
- **THEN** drawer chiếm toàn màn hình, nút footer giãn đều đủ rộng để chạm

### Requirement: Bảng dạng thẻ trên điện thoại
Dưới 640px, mọi bảng dữ liệu SHALL hiển thị mỗi dòng thành 1 thẻ (tên cột : giá trị), không cuộn ngang; ô lọc trên thanh công cụ SHALL full width mỗi ô 1 hàng.

#### Scenario: CSKH mở danh sách tour trên điện thoại
- **WHEN** mở `/tour` ở màn hình 375px
- **THEN** mỗi tour là 1 thẻ, nút "…" ở góc phải, chạm thẻ mở chi tiết tour

### Requirement: Thẻ thống kê không cắt số tiền trên mobile
Trang tour của KTV SHALL hiển thị đầy đủ tổng tiền "Đã nhận" ở màn hình 375px.

#### Scenario: KTV xem tour tháng
- **WHEN** KTV mở tab "Tour của tôi" trên điện thoại
- **THEN** tổng tiền đã nhận hiển thị đủ, không bị "…"
