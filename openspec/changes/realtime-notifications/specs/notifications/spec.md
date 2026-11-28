## ADDED Requirements

### Requirement: Chống trùng, chống spam, đúng người
Mọi thông báo SHALL tạo qua `notify_users()`. Người nhận SHALL là user `active`, KHÁC người thao tác.
Một thao tác (1 dòng thay đổi) SHALL tạo tối đa 1 thông báo / người. Thông báo chưa đọc cùng `kind + ref`
SHALL bị thay bằng bản mới (không chồng nhiều dòng). Thay đổi do trigger khác gây ra (`pg_trigger_depth() > 1`)
SHALL không phát thông báo lịch hẹn (tránh trùng với thông báo tour).

#### Scenario: Sửa giờ hẹn 3 lần liền
- **WHEN** Telesales đổi giờ 1 lịch hẹn có Sales phụ trách 3 lần, Sales chưa mở chuông
- **THEN** Sales chỉ có 1 thông báo chưa đọc, giờ mới nhất

#### Scenario: Tự thao tác
- **WHEN** Sales tự giao lịch hẹn cho chính mình
- **THEN** không có thông báo

### Requirement: Lịch hẹn (Quản lý đặt lịch + Quản lý bán hàng)
| Sự kiện | Người nhận |
|---|---|
| Tạo lịch hẹn (không phải Telesales của khách tạo) | Telesales phụ trách lịch (`staff_id`) |
| Giao Sales (`sales_id` đổi) | Sales được giao |
| Khách đến cơ sở (`checked_in` → true) | Sales phụ trách (chưa có → cả bộ phận Sales), Telesales, Master |
| Đổi giờ hẹn | Telesales, Sales, Master của lịch |
| Huỷ / xoá lịch | Telesales, Sales, Master của lịch |

#### Scenario: Khách chưa có Sales đến cơ sở
- **WHEN** lễ tân bấm Đến cơ sở cho lịch chưa có Sales
- **THEN** mọi Sales đang hoạt động nhận "Khách X đã đến cơ sở"

### Requirement: Tour
| Sự kiện | Người nhận |
|---|---|
| Tour thật chưa có Master (tạo mới / dự kiến → thật) | Mọi Master đang hoạt động — gộp 1 thông báo / khách |
| Được giao (người khác chọn Master) | Master được giao |
| Đổi ngày / huỷ tour đã có Master | Master đó |

Tour dự kiến (`planned`) SHALL không phát thông báo. Khi khách không còn tour chờ nhận, thông báo "chờ nhận"
chưa đọc SHALL bị gỡ.

### Requirement: Thẻ liệu trình
| Sự kiện | Người nhận |
|---|---|
| Bán thẻ | Telesales phụ trách khách |
| Thu tiền (người khác Sales bán thẻ) | Sales bán thẻ (`created_by`) |
| Hoàn tiền thẻ / hoàn 1 dịch vụ | Admin + Sales bán thẻ |
| Huỷ thẻ | Sales bán thẻ |

### Requirement: Hành trình điều trị
Mỗi Telesales SHALL nhận tối đa 1 thông báo tổng hợp / ngày (UTC+7) khi có khách đến hạn hoặc quá hạn
(chưa có lịch hẹn sắp tới), tính bằng `journeyDue`. Unique index `(user_id, kind, ref)` SHALL chặn trùng
khi mở nhiều tab.

### Requirement: Tài liệu
Tài liệu mới SHALL báo user được xem (admin, hoặc bộ phận trong `departments`, rỗng = tất cả), trừ người tạo.
Bình luận SHALL báo tác giả tài liệu; trả lời SHALL báo người viết bình luận gốc (không báo 2 lần nếu trùng tác giả).
Thích (like) SHALL không phát thông báo.

### Requirement: Hiển thị trên web
Chuông SHALL hiện toast khi có thông báo mới qua realtime, gộp dòng cùng `kind + ref`, mỗi `kind` có icon + chữ i18n.
