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
