## Why

Ảnh xác nhận thanh toán (`customers.payment_confirm_url`) chỉ xem được khi mở form sửa khách. Cần nhìn nhanh ngay trên bảng `/customers`.

## What Changes

- Cột **Deposit** trên bảng `/customers`: nếu khách có ảnh xác nhận thanh toán → hiện thumbnail 28×28 cạnh số tiền; bấm vào mở preview ảnh to (antd `Image` preview: zoom/xoay/đóng).
- Không có tiền cọc nhưng có ảnh → chỉ hiện thumbnail. Không có cả hai → "—" như cũ.
- Không đổi DB, không thêm component mới.

## Impact

- `components/customers/customers-manager.tsx`
