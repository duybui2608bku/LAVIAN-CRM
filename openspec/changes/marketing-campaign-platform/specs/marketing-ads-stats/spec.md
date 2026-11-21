## ADDED Requirements

### Requirement: Cột Nền tảng của bảng chiến dịch
Bảng chiến dịch SHALL hiện cột "Nền tảng": WhatsApp và/hoặc Instagram theo `destination_type` các nhóm QC của chiến dịch (chứa `WHATSAPP` → WA; chứa `INSTAGRAM`/`IG_DIRECT` → IG). Nền tảng là ĐÍCH nhắn tin, không phải vị trí hiển thị (quảng cáo video trên IG nhưng đích `WHATSAPP` → chỉ WA). Phễu dòng cha vẫn cộng khách IG gán qua ad_id. Không lấy được destination_type (lỗi/giới hạn API) → đoán theo tên (`WA<4 số>`, token `IG`/`IGonly`/`ONLYIG`). Số WA (tag) luôn lấy từ tên `WA<4 số>`.

#### Scenario: Chiến dịch chạy cả WA và IG
- **WHEN** chiến dịch có cả 2 nền tảng
- **THEN** dòng có nút mở rộng; bung ra 2 dòng con WA và IG, mỗi dòng hiện phễu KH tiềm năng / Đặt lịch / Đến cơ sở của riêng nền tảng đó

#### Scenario: Không nhận ra nền tảng
- **WHEN** tên không có WA<4 số> lẫn IG và không có khách IG
- **THEN** cột hiện "—"

### Requirement: Tên chiến dịch mở Ads Manager
Tên chiến dịch SHALL là link mở tab mới tới `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=<id tài khoản>&business_id=<BM>&nav_source=no_referrer&treenav=true&selected_campaign_ids=<id chiến dịch>`.

### Requirement: Phễu Marketing theo lúc gắn tag
Trang Marketing SHALL đếm: **KH tiềm năng** = khách SMAX xuất hiện lần đầu trong kỳ có tag `phone`, `booking` hoặc `bookings-deposit` (KHÔNG gồm `purchase`); **Đặt lịch** = tag `booking`/`bookings-deposit` gắn trong kỳ; **Đến cơ sở** = tag `purchase` gắn trong kỳ — mọi khách, kể cả khách cũ. Thẻ thống kê có Đặt lịch, Đến cơ sở; bảng có cột Chi tiêu / Đặt lịch.

#### Scenario: Khách có cả booking và purchase
- **WHEN** khách được gắn `booking` và `purchase` trong kỳ
- **THEN** tính 1 Đặt lịch và 1 Đến cơ sở

#### Scenario: Khớp Báo cáo SMAX
- **WHEN** cùng khoảng ngày
- **THEN** tổng Đặt lịch / Đến cơ sở bằng Booking / Khách đến của Báo cáo SMAX
