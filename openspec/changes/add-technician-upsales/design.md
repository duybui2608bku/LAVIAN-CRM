## Context

`appointments` đã có `technician_id`, trạng thái vận hành và các dữ liệu con như dịch vụ/thanh toán. Upsale là một dịch vụ bán thêm kèm số tiền phát sinh trong ngày khách đến; dịch vụ này được chọn độc lập với dịch vụ gốc của lịch nhưng số tiền phải tham gia nghĩa vụ thanh toán của sổ.

## Goals / Non-Goals

**Goals:**

- Một lịch hẹn có thể có nhiều record upsale con.
- Mỗi record nghiệp vụ yêu cầu một dịch vụ và một số tiền dương.
- Cộng được tổng upsale của từng lịch và truy vết người tạo/thời điểm.
- Mọi user đăng nhập được ghi upsale khi khách đã check-in hoặc lịch đã hoàn tất.
- Đổi được kỹ thuật viên trực tiếp trên bảng lịch hẹn.

**Non-Goals:**

- Không tạo dòng `appointment_payments`.
- Không làm duyệt, chốt/từ chối, hoa hồng hoặc báo cáo tổng hợp.
- Không cho sửa trực tiếp record; nhập sai thì xóa và thêm lại.

## Decisions

1. Tạo bảng `appointment_upsales` với `id`, `appointment_id`, `service_id`, `amount`, `created_by`, `created_at`. Sổ thanh toán được suy ra qua `appointment_id → appointments.ledger_id`; `service_id` bắt buộc, FK tới `services` với `on delete restrict`; `amount` phải lớn hơn 0.
2. `appointment_id` dùng `on delete cascade` vì upsale không có ý nghĩa khi lịch hẹn nguồn bị xóa cứng; lịch hẹn trong UI đang xóa mềm nên dữ liệu thông thường vẫn được giữ.
3. Record bất biến: không cấp quyền update. Người tạo hoặc admin có thể xóa record sai.
4. RLS cho phép mọi user đăng nhập đọc và thêm upsale cho lịch có trạng thái `checked_in`/`completed`; `created_by` luôn phải bằng user hiện tại. Server action kiểm tra lại trạng thái để trả lỗi thân thiện.
5. Query lịch hẹn nạp nested `appointment_upsales` của từng lịch rồi gom theo `appointments.ledger_id`. Tổng giá phải thanh toán là `service_ledgers.total_amount + Σ appointment_upsales.amount` của mọi lịch cùng sổ; công nợ và giới hạn thu tiền dùng tổng này.
6. UI dùng một dialog nhỏ từ hàng thao tác của lịch: hiển thị tổng, danh sách dịch vụ + số tiền, select dịch vụ độc lập, ô tiền và nút thêm/xóa. Nút thêm xuất hiện cho mọi user ở lịch `checked_in`/`completed`.
7. Cột Kỹ thuật viên dùng select inline. Server action chỉ nhận `null` hoặc profile `department = technician`, `status = active`; trigger DB hiện có tiếp tục là lớp kiểm tra cuối.

## Risks / Trade-offs

- [Upsale làm tăng nghĩa vụ thanh toán] → không tự tạo dòng thu; nhân viên vẫn ghi thanh toán thực tế trong dialog Thanh toán.
- [Dịch vụ upsale có thể khác dịch vụ lịch] → record lưu FK riêng, không cập nhật `appointment_services`.
- [Nhiều record trên một lịch] → phù hợp yêu cầu record con; tổng luôn được suy ra bằng phép cộng, không lưu trùng.
- [KTV nhập sai] → record bất biến, xóa rồi thêm lại để giữ luồng đơn giản.

## Migration Plan

1. Tạo migration bằng Supabase CLI, thêm bảng, index, RLS, policies và grants.
2. Deploy code query/action/UI cùng migration.
3. Rollback bằng cách drop `appointment_upsales`; không ảnh hưởng dữ liệu lịch hẹn hoặc sổ tiền.

## Open Questions

Không còn.
