# public-lead-form

## ADDED Requirements

### Requirement: Ghi nhớ Telesales trên máy
Khi người dùng tự chọn Telesales trên `/lead-form`, hệ thống SHALL lưu id vào `localStorage` (key `lavian-lead-staff`). Khi ô Telesales đang trống (mở form, đổi khách, bấm gửi tiếp) và id đã lưu còn trong danh sách Telesales, form SHALL tự điền id đó. Khách đã có CSKH trong CRM SHALL giữ CSKH hiện tại.

#### Scenario: Lần sau khỏi chọn
- **WHEN** Telesales từng chọn tên mình trên form, sau đó mở lại form cho khách mới
- **THEN** ô Telesales đã điền sẵn tên đó

#### Scenario: Khách đã có CSKH
- **WHEN** khách Smax đang mở đã có trong CRM với CSKH khác người đã lưu
- **THEN** ô Telesales hiện CSKH hiện tại của khách
