# customers

## ADDED Requirements

### Requirement: Khách Instagram không bắt buộc SĐT
Hệ thống SHALL cho lưu khách nguồn Instagram khi chưa có SĐT (lưu `''`); khách WhatsApp SHALL vẫn bắt buộc SĐT hợp lệ.

#### Scenario: Lead form ở hội thoại Instagram, khách chưa cho số
- **WHEN** Telesales mở lead form ở hội thoại IG, để trống SĐT, chọn Tiềm năng + lịch nhắc rồi Submit
- **THEN** khách mới được tạo với nguồn Instagram, SĐT rỗng, không báo lỗi

#### Scenario: Lead form ở hội thoại WhatsApp thiếu SĐT
- **WHEN** Telesales để trống SĐT ở hội thoại WA
- **THEN** form báo SĐT không hợp lệ và không lưu

#### Scenario: Cập nhật khách cũ để trống SĐT
- **WHEN** khách đã có SĐT trong CRM và Telesales bấm Cập nhật với ô SĐT trống
- **THEN** SĐT trong CRM giữ nguyên

#### Scenario: Nhiều khách IG chưa có SĐT
- **WHEN** đã có khách IG SĐT rỗng và tạo thêm khách IG SĐT rỗng
- **THEN** không bị báo trùng SĐT
