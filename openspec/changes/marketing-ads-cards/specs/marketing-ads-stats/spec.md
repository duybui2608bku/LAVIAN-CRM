## ADDED Requirements

### Requirement: Trang Marketing hiển thị 7 chỉ số quảng cáo
Trang `/marketing` (chỉ admin) SHALL hiển thị 7 card theo khoảng ngày VN, mặc định hôm nay: Chi tiêu, Tin nhắn, Chi tiêu/Tin nhắn, Data, Chi tiêu/SĐT, Lịch hẹn, Đã đến.

#### Scenario: Cộng số liệu 2 tài khoản ads
- **WHEN** admin chọn khoảng ngày
- **THEN** Chi tiêu và Tin nhắn là tổng của `act_1494701561142295` và `act_405282048979489`

#### Scenario: Chỉ số chia khi mẫu bằng 0
- **WHEN** Tin nhắn hoặc Data bằng 0 hoặc lỗi
- **THEN** card chia tương ứng hiển thị "—"

#### Scenario: Lỗi một nguồn
- **WHEN** FB, SMAX hoặc Supabase lỗi
- **THEN** chỉ các card dùng nguồn đó hiện "—" kèm thông báo lỗi, các card khác vẫn hiển thị
