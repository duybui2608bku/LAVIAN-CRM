# Design: customer-360-phase1

## Bối cảnh

- Lịch hẹn: `clinic_appointments`. Đã có `technician_id` (Master), `sales_id`, `staff_id` (Telesales), `bill_amount`, `paid_amount`, timeline `notes` / `sales_notes`, log qua trigger vào `clinic_appointment_logs`. Tiền cọc nằm ở `customers.deposit_amount`.
- Quyền: `department_permissions` theo bộ phận `telesales | telesales_leader | sales | technician`. Admin có mọi quyền. Technician đã có `appointments.view/edit`, nên Master dùng được Drawer ở `/appointments`.
- Tin SMAX: `fetchThreadMessages(link)` gọi API SMAX phía server (`MESSAGE_LIMIT = 20`), đang dùng ở `MessagesModal`.

## Mô hình dữ liệu (migration `20261120120000_customer_360.sql`)

### 1. `customer_portrait_entries`: chân dung, chỉ thêm (B1–B5)
```
id uuid pk, customer_id uuid fk customers on delete cascade,
field text check in ('wish','pain','preference','behavior','communication','personality'),
text text check (char_length between 1 and 1000),
source text check in ('customer','staff'),      -- Khách nói / NV nhận định
message_ref jsonb null,                         -- {id, at, text} tin SMAX gốc (chụp lại để không mất khi SMAX đổi)
created_by uuid fk profiles default auth.uid(), created_at timestamptz default now()
index (customer_id, field, created_at desc)
```
- Bản đang hiện của một mục là dòng mới nhất của mục đó. Lịch sử là tất cả các dòng. Như vậy **bảng chính là audit log**, không cần bảng log riêng.
- RLS: user active đọc được và thêm được (`created_by = auth.uid()`). **Không có policy update/delete**, nên không ai sửa hay xoá được lịch sử (B4). "Xoá" một mục bằng cách thêm dòng mới ghi rõ là không còn đúng.

### 2. `customer_needs`: nhu cầu / Upsell pipeline (C1, C2)
```
id uuid pk, customer_id fk cascade,
title text (1..200),                 -- vd "Lip Blush", "Giảm béo"
service_id uuid null fk services on delete set null,
origin text check in ('customer_asked','staff_found'),
status text check in ('need','consulting','upsell','won','lost') default 'need',
history jsonb default '[]',          -- [{status, by_id, at}] server append mỗi lần đổi trạng thái
created_by, created_at, updated_at
```
- "Nhu cầu tiếp theo" ở đầu popup là nhu cầu mới nhất chưa ở trạng thái `won/lost`.
- RLS: user active được select/insert/update. Không có policy delete.

### 3. `appointment_performers`: người thực hiện thêm (E3)
```
appointment_id fk clinic_appointments cascade, profile_id fk profiles cascade,
role text,   -- 'mapping' | 'tattoo' | 'assist' | 'sales' (danh sách trong code, server kiểm tra)
created_by, created_at, primary key (appointment_id, profile_id)
```
- `technician_id` vẫn là **Master phụ trách**: người xác nhận kết thúc, và là cột báo cáo/tour đang dùng. Bảng này chỉ chứa người thực hiện thêm.
- Server kiểm tra bộ phận: role `sales` phải là user bộ phận `sales`, các role còn lại phải là `technician`.
- Drawer lưu cả danh sách cùng lúc: xoá hết danh sách cũ rồi thêm danh sách mới, trong 1 RPC `set_appointment_performers` (security invoker) để không bị lưng chừng.

### 4. `appointment_photos` + bucket riêng tư `ba-photos` (F1)
```
id uuid pk, appointment_id fk cascade, customer_id fk cascade,
kind text check in ('before','after'), path text not null,
created_by default auth.uid(), created_at
```
- Bucket `ba-photos` để `public = false`, giới hạn 10MB, chỉ nhận ảnh. Đường dẫn file: `<customer_id>/<appointment_id>/<uuid>.<ext>`.
- Upload: client tải thẳng lên Storage bằng supabase-js (Server Action giới hạn body 1MB), sau đó gọi action ghi dòng vào `appointment_photos`.
- Policy Storage: insert/select/delete chỉ cho user active thuộc bộ phận **khác** `telesales`/`telesales_leader`, hoặc admin. Delete chỉ người upload hoặc admin. Xem ảnh bằng signed URL (1 giờ), tạo ở server action.
- Bảng `appointment_photos` dùng cùng điều kiện bộ phận cho RLS.

### 5. `customers.smax_messages jsonb` + `smax_messages_at timestamptz`
- Lead-form, lúc Gửi/Cập nhật, gọi `fetchThreadMessages(link, 30)` rồi lưu kết quả `ChatMessage[]`. Nếu SMAX lỗi thì bỏ qua, không chặn việc lưu lead.

### 6. Ràng buộc trạng thái trên `clinic_appointments` (`NOT VALID`, chỉ áp cho lần ghi mới)
```
check (visit_status <> 'done' or technician_id is not null)
check (visit_status <> 'in_progress' or technician_id is not null or sales_id is not null)
```
Server cũng kiểm tra trước để báo lỗi tiếng Việt dễ hiểu. Ràng buộc DB là chốt chặn cuối cho mọi đường ghi, kể cả sửa inline trên bảng.

## Server

`app/(app)/customers/customer-360-actions.ts`:
- `getCustomer360(customerId)`: cần một trong các quyền `customers.view` / `appointments.view` / `appointments.edit`. Đọc song song:
  - thông tin khách
  - lịch hẹn (chưa xoá) kèm người thực hiện
  - chân dung
  - nhu cầu
  - lịch nhắc đang mở
  - log lịch hẹn
  - ảnh (signed URL)

  Dữ liệu **tài chính** và **ảnh** chỉ trả về khi `canSeeFinance` / `canSeePhotos` của người gọi đúng. Ẩn ở server chứ không chỉ ẩn ở UI.
- `addPortraitEntry`, `addCustomerNeed`, `setNeedStatus`, `addAppointmentPhoto`, `deleteAppointmentPhoto`, `setAppointmentPerformers`.
- Ghi chú nhanh dùng lại action ghi chú khách đang có (`customers.notes`).

`lib/customer-360.ts` chứa hàm thuần, có `node --test`:
- `customerRole(profile)` → `'telesales' | 'sales' | 'master' | 'admin'`
- `canSeeFinance(profile)`: admin, sales, telesales_leader
- `canSeePhotos(profile)`: tất cả trừ telesales và telesales_leader
- `customerFinance(appointments, deposit)` → `{ total, current, history }`. Phải thu bằng `null` (Chưa xác định) khi có cọc mà Giá trị DV = 0.
- `latestPortrait(entries)`, `nextNeed(needs)`, `mergeTimeline(...)`

`lib/appointments.ts`:
- `validateVisitStatus(patch, current, deposit)`: kiểm tra quy tắc E3. Gọi trong `patchAppointment` / `createAppointment` sau khi đọc bản ghi hiện tại.
- Quyền đổi trạng thái: `canSetVisitStatus(profile, status)`. Sales/admin đổi được mọi trạng thái, technician chỉ được chọn `done`.

## UI

- `components/customers/customer-360/customer-360-modal.tsx`: antd `Modal` rộng ~1200, layout theo demo (đầu popup + 3 ô tóm tắt, tabs, cột trái chân dung nhanh, nội dung chính, footer). Trên điện thoại ẩn cột trái và chuyển sang 1 cột. Dữ liệu tải bằng React Query `["customer-360", id]`, invalidate sau mỗi lần ghi.
- Props: `customerId`, `ids: string[]` (danh sách đang lọc, theo đúng thứ tự bảng, đã bỏ trùng), `onNavigate(id)`, `onEdit?(customerId)` (Chuyển sang nhập liệu), `onClose`. Popup **không giữ bộ lọc**. Bảng cha vẫn giữ state của mình, nên đóng popup không mất trang hay vị trí cuộn.
- Mỗi tab là một file nhỏ: `overview`, `portrait`, `services` (Upsell + tài chính), `photos`, `messages` (dùng lại phần render bong bóng chat của `MessagesModal`, tách thành `ChatBubbles`), `timeline`, `care` (Coming soon).
- Quản lý bán hàng: bấm tên khách mở popup, icon ✎ mở Drawer. "Chuyển sang nhập liệu" đóng popup rồi mở Drawer của lịch gần nhất của khách trong bảng.
- Drawer Sales: thêm mục **Người thực hiện thêm** (`Form.List`: chọn người + vai trò) và mục **Ảnh B/A** (upload Trước/Sau). Hiện "Phải thu: Chưa xác định" theo E2. Lỗi theo quy tắc E3 hiện ngay tại field.
- Theo quy tắc ui-ux-pro-max: dùng component antd + token có sẵn, không thêm màu mới. Nhãn nguồn dùng `Tag` (Khách nói = xanh lá, NV nhận định = mặc định). Tab nào bị ẩn theo quyền thì không render.

## Rủi ro / đánh đổi

- **Bản chụp 30 tin** chỉ mới khi Gửi/Cập nhật lead. Tab Hội thoại đọc trực tiếp từ SMAX trước, nên không bị cũ. Bản chụp chỉ để dành cho AI và dự phòng.
- **Ràng buộc `NOT VALID`** không kiểm tra lịch cũ đang vi phạm. Nhưng lần sửa tiếp theo của lịch đó sẽ bị chặn cho đến khi chọn Master. Đây là hành vi mong muốn.
- **Ảnh riêng tư** cần signed URL nên chậm hơn ảnh public một chút. Đổi lại đúng chủ trương phân quyền ảnh (B1, F4).
- Ma trận quyền chi tiết còn chờ sếp. Hai quy tắc ẩn nằm gọn trong `lib/customer-360.ts`, nên đổi sau chỉ phải sửa một chỗ.
