## ADDED Requirements

### Requirement: Không prefetch link điều hướng chính
Các link điều hướng trong khung ứng dụng (sidebar, logo, thanh tab dưới, menu sheet) SHALL đặt `prefetch={false}`
để trang chỉ gọi server khi người dùng thực sự bấm, tránh nhân số lượt gọi function trên Vercel.

#### Scenario: Mở trang Khách hàng
- **WHEN** admin mở `/customers` với sidebar hiển thị ~10 mục
- **THEN** trình duyệt chỉ gửi request cho `/customers`, không gửi request prefetch cho các mục còn lại

#### Scenario: Bấm một mục menu
- **WHEN** bấm mục Lịch hẹn trong sidebar
- **THEN** route `/appointments` được tải và hiển thị bình thường
