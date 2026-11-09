## ADDED Requirements

### Requirement: Trang Báo cáo cho admin
Hệ thống SHALL có trang `/reports` chỉ admin truy cập, hiển thị 8 chỉ số theo khoảng ngày: Chi tiêu, Tin nhắn, Chi tiêu / Tin nhắn, Data, Chi tiêu / Data, Đặt cọc, Đặt lịch, Doanh thu.

#### Scenario: Người không phải admin
- **WHEN** user thường mở `/reports`
- **THEN** bị chuyển về trang chủ và không thấy mục "Báo cáo" trên menu

#### Scenario: Chỉ số chia khi mẫu bằng 0
- **WHEN** Tin nhắn hoặc Data bằng 0 hoặc nguồn lỗi
- **THEN** card chia tương ứng hiển thị "—"

#### Scenario: Lỗi một nguồn
- **WHEN** Facebook hoặc Supabase lỗi
- **THEN** chỉ các chỉ số dùng nguồn đó hiện "—" kèm thông báo lỗi, các chỉ số khác vẫn hiển thị

### Requirement: So sánh kỳ trước
Mỗi card SHALL hiển thị % thay đổi so với kỳ liền trước cùng số ngày; với chỉ số chi phí (Chi tiêu / Tin nhắn, Chi tiêu / Data) giảm được tô màu tốt.

#### Scenario: Kỳ trước bằng 0
- **WHEN** giá trị kỳ trước bằng 0 hoặc không có
- **THEN** không hiện % thay đổi

### Requirement: Chi tiết theo ngày
Trang SHALL có biểu đồ cột theo ngày cho chỉ số được chọn và bảng từng ngày đủ 8 chỉ số kèm dòng tổng của khoảng.

#### Scenario: Bảng khớp card
- **WHEN** admin chọn khoảng ngày
- **THEN** dòng tổng của bảng bằng giá trị trên các card
