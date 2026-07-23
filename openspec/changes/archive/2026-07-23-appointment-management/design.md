# Design: appointment-management

## Context

Module `customers` hiện đã ổn cho CRM khách hàng cơ bản: có bảng `public.customers` lưu `stage/source/staff_id/notes/deleted_at`, trang `/customers` đọc dữ liệu qua 1 query chính + dữ liệu phụ (`profiles`, `enum_options`, `services`), và UI đã hỗ trợ lọc, inline edit, quick note, multi-service.

Tuy nhiên workflow thực tế của Lavian hiện vẫn đang chạy bằng Excel theo nhiều sheet tách rời:

- sheet booking (`DATA BOOKING`)
- sheet lịch hẹn theo tháng/ngày (`JANJI TEMU 626/726`, `JANJI TAMU 126`) — row nhóm theo ngày, trong ngày nhóm theo trạng thái: Sudah Datang / Re schedule / Deposit; cột tiền dạng text "Service : X / Price : Rp N / DP : Rp N (ngày) / Paid : Rp N (ngày) / Sisa : Rp N"
- sheet cọc chưa có ngày hẹn (`DP CUS`, `DP ARA`) — khách đã chuyển DP nhưng ngày hẹn còn "info", chờ khách báo
- sheet liệu trình / chăm sóc sau dịch vụ (`CS DATA`, `CUST ARA`) — đánh dấu Laser 1→n, Sulam baru, Retouch, ngày tái hẹn ("18/12 retouch") và trạng thái nhắc ("udh remind")
- sheet tổng hợp doanh thu ngày (`REPORT`)
- sheet telesale gọi lead (Helen) — ngoài phạm vi phase này, note trên customer đủ

Điểm nghẽn là dữ liệu lịch hẹn chưa có thực thể riêng. Trạng thái `booked` trong `customers.stage` mới phản ánh góc nhìn sales, chưa đủ để vận hành một lịch hẹn thật với ngày giờ, dời lịch, check-in, no-show, và số tiền quản trị nội bộ.

Phạm vi đã chốt thêm:

- chỉ có 1 chi nhánh
- số tiền không liên quan thanh toán trên web
- hệ thống chỉ cần nhập số tiền để quản lý và thống kê nội bộ

## Goals / Non-Goals

**Goals:**
- Tạo lớp dữ liệu chuẩn cho lịch hẹn, bám trên `customers` thay vì tạo hệ song song.
- Tách rõ `trạng thái khách` và `trạng thái từng lịch hẹn`.
- Chuẩn hóa phần số tiền nội bộ để quản lý và thống kê, không nhét vào note.
- Hỗ trợ luồng vận hành thực tế: đặt lịch, xác nhận, dời lịch, check-in, hoàn tất, no-show.
- Giữ hướng triển khai phù hợp với pattern Supabase + Next hiện có của repo.

**Non-Goals:**
- Không làm đa chi nhánh trong phase này.
- Không làm cổng thanh toán, webhook, trạng thái thanh toán online, hay đối soát.
- Chưa làm bài toán phân ca kỹ thuật viên, room/resource scheduling, capacity planning.
- Không làm automation gửi WhatsApp thật; phase đầu chỉ chuẩn bị schema + trạng thái để nối sau nếu cần.
- Chưa làm dashboard BI sâu; chỉ chuẩn bị dữ liệu chuẩn để dashboard làm sau.
- Chưa đưa combo nhiều dịch vụ vào cùng một lịch hẹn ở phase 1 nếu chưa thật sự cần.

## Decisions

1. **`customers` tiếp tục là hồ sơ gốc, `appointments` là thực thể vận hành**
   - `customers` giữ vai trò CRM-level: ai là khách, nguồn nào, nhân viên nào phụ trách, đang ở giai đoạn nào.
   - `appointments` là bản ghi vận hành của từng lần hẹn: ngày giờ, dịch vụ, trạng thái, số tiền nội bộ, ghi chú.
   - Một `customer` có nhiều `appointments`.

2. **Tách `customer.stage` và `appointment.status`**
   - `customer.stage` tiếp tục dùng cho pipeline sales/CRM tổng quát: `new_lead`, `consulting`, `deposited`, `booked`, `visited`, `returning`, `lost`.
   - `appointment.status` dùng cho lifecycle của từng lịch hẹn: `pending_confirmation`, `booked`, `checked_in`, `completed`, `no_show`, `cancelled` — khớp đúng các trạng thái nhân viên đang dùng trên sheet (xem Status Mapping).
   - Dời lịch ("Re schedule") là SỰ KIỆN, không phải status: cập nhật `scheduled_at`, status giữ nguyên `booked`, ghi 1 dòng history. Nếu coi là status thì mọi filter "lịch sắp tới" và báo cáo đếm booked đều sai.
   - `status` do code điều khiển (transition + timestamp) nên KHÔNG đưa vào `enum_options` cho admin sửa; hardcode const TS + `check` constraint trong DB.
   - Không dùng một field để gánh cả hai bài toán vì sẽ làm báo cáo và UI mâu thuẫn.

3. **Tạo 3 bảng phase 1**
   - `public.appointments`
   - `public.appointment_services` (bảng nối, copy nguyên pattern `customer_services`)
   - `public.appointment_status_history`

   Đủ để thay workflow Excel hiện tại ở phase đầu. Nếu sau này thật sự cần chi tiết nhiều lần thu tiền hoặc reminder tự động, mới thêm bảng riêng ở phase 2.

4. **`appointments` lưu snapshot nghiệp vụ quan trọng, không chỉ FK**
   - Có FK tới `customers`, `services`, `profiles`.
   - Đồng thời lưu snapshot các field hay báo cáo/lọc trực tiếp như `source`, `expected_amount`, `deposit_amount`, `final_amount`.
   - `source` cấp lịch hẹn trên sheet gồm cả `CS Lama` (khách cũ quay lại), `Pancake`, `Facebook` — admin tự thêm value vào `enum_options` kind `source`, không cần code.
   - Lý do: dữ liệu lịch sử không nên đổi theo lần sửa hồ sơ khách sau này.

5. **Một lịch hẹn có nhiều dịch vụ — bảng nối `appointment_services`**
   - Dữ liệu thật cho thấy combo là chuyện thường, không phải ngoại lệ: "Sulam Alis, Sulam Bibir", gói VIP alis + all lips treatment, laser + sulam cùng buổi xuất hiện dày đặc trong `JANJI TEMU` và `CS DATA`.
   - Repo đã có sẵn pattern `customer_services` (migration + RLS + grant) và component `multi-select` — copy nguyên, chi phí gần bằng 0.
   - Không lưu `service_id` đơn trên `appointments`; combo ghi qua bảng nối, ghi chú thêm để ở `booking_note`.

6. **Tiền chỉ là dữ liệu quản trị nội bộ, không phải payment transaction**
   - Cấu trúc tiền trên sheet khớp thẳng: Price → `expected_amount`, DP → `deposit_amount`, Paid/chốt cuối → `final_amount`, Sisa → `outstanding` (tính, không lưu).
   - Thêm `payment_method` (bank/cash/card) — cột "metode" nhân viên đang ghi, chỉ là nhãn thống kê.
   - Sheet có case trả nhiều đợt ("Paid : Rp 3.8tr (22/12) / Paid : Rp 1tr (2/7)") — phase 1 nhập tổng vào `final_amount`, chi tiết từng đợt ghi note; nếu thành nhu cầu thật mới tách bảng payment phase 2.
   - Không xử lý cổng thanh toán, webhook, trạng thái thu hộ, hay đối soát.

7. **Lịch sử trạng thái là bắt buộc — ghi bằng trigger**
   - Trigger `after update ... when (old.status is distinct from new.status)` trên `appointments` tự insert vào `appointment_status_history` (changed_by = `auth.uid()`). Mọi action tương lai không thể quên ghi history; không ghi tay ở app-level.
   - History là audit bất biến: chỉ `grant select, insert`, không grant update/delete.
   - Đây là lớp thay thế cho việc người dùng đọc note hoặc sheet cũ để đoán lịch sử.

8. **UI theo 3 bề mặt chính**
   - `Appointments Calendar/List`: xem và lọc lịch theo ngày, nhân viên, trạng thái, dịch vụ.
   - `Appointment Drawer/Dialog`: tạo/sửa lịch hẹn.
   - `Customer Timeline`: từ customer nhìn ra các appointment liên quan.

   Không mở thêm quá nhiều page ngay từ đầu; nên bám pattern của `/customers` rồi mở rộng dần.

9. **Không thêm `branch_id`**
   - Vì hiện chỉ có 1 chi nhánh nên không thêm `branch_id`, không thêm filter cơ sở, không thêm tầng phân quyền theo cơ sở.
   - Khi nào có chi nhánh thứ 2 thì mới mở rộng schema.

10. **RLS đồng nhất với phần CRM hiện có**
   - Hiện `customers` đang cho `authenticated` toàn quyền.
   - Phase 1 của `appointments` nên giữ cùng mô hình để tránh đẻ thêm ma trận quyền giữa chừng.
   - Mỗi bảng mới phải có cả `enable row level security` lẫn `grant select, insert, update, delete ... to authenticated`.
   - Lưu ý Supabase hiện không còn đảm bảo bảng mới tự exposed cho Data API nếu thiếu grant tường minh.

11. **Không derive mọi thứ tự động quá sớm — stage chỉ đi TIẾN**
   - Khi tạo appointment có thể cập nhật `customer.stage -> booked`; có deposit -> `deposited`; check-in/completed -> `visited`.
   - Chỉ nâng stage khi stage mới có `sort_order` cao hơn stage hiện tại (khách `visited`/`returning` đặt lịch mới không được tụt về `booked`). Một dòng so sánh trong server action, không trigger.

12. **Cọc chưa có ngày hẹn: `scheduled_at` nullable (thay sheet `DP CUS`)**
   - Workflow thật có hẳn 2 sheet cho khách đã chuyển DP nhưng ngày hẹn còn "info" chờ khách báo.
   - Cho phép tạo appointment với `deposit_amount` + `scheduled_at = null`, status `pending_confirmation`.
   - Tab "Chờ xếp lịch" trên `/appointments` lọc `scheduled_at is null` — thay việc dò sheet DP CUS; lần nhắc khách ghi vào `internal_note`.
   - Khách chốt ngày → điền `scheduled_at`, chuyển `booked`.

13. **Tái hẹn / liệu trình = tạo trước appointment kế tiếp (thay sheet `CS DATA`)**
   - Sheet CS DATA thực chất là danh sách "ngày phải quay lại" (retouch ~45 ngày, laser đợt tiếp) + trạng thái nhắc.
   - Khi hoàn tất một lịch, action nhanh "Đặt lịch tái hẹn" tạo luôn appointment kế tiếp `pending_confirmation` với ngày dự kiến (hoặc null nếu chưa biết).
   - View lọc "sắp đến hạn" (pending_confirmation trong X ngày tới) thay cột "18/12 retouch" + "udh remind". Không bảng mới, không automation nhắc tự động ở phase 1.
   - Số buổi trong gói ("Laser 3/4") và bảo hành ghi bằng `booking_note` — đúng cách nhân viên đang ghi text trên sheet. Chỉ tách bảng `treatment_courses` (+ cột `course_id` nullable trên `appointments`, backfill được) khi cần đếm tự động số buổi còn lại hoặc logic bảo hành thật.

## Proposed Schema

### 1. `public.appointments`

Các cột chính:

- `id uuid primary key default gen_random_uuid()`
- `customer_id uuid not null references public.customers(id) on delete cascade`
- `staff_id uuid null references public.profiles(id) on delete set null`
- `scheduled_at timestamptz null` — null = đã cọc, chưa chốt ngày (Decision 12)
- `duration_minutes int not null default 60`
- `status text not null check (status in ('pending_confirmation','booked','checked_in','completed','no_show','cancelled'))`
- `source text null`
- `payment_method text null` — bank/cash/card, nhãn thống kê (cột "metode")
- `deposit_amount numeric(12,2) not null default 0`
- `expected_amount numeric(12,2) null`
- `final_amount numeric(12,2) null`
- `booking_note text null`
- `internal_note text null`
- `confirmed_at timestamptz null`
- `checked_in_at timestamptz null`
- `completed_at timestamptz null`
- `cancelled_at timestamptz null`
- `created_by uuid null references public.profiles(id) on delete set null`
- `updated_by uuid null references public.profiles(id) on delete set null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz null`

Giá trị tính ở app/report:

- `outstanding_amount = max(final_amount - deposit_amount, 0)` — chính là cột "Sisa" trên sheet

Index đề xuất:

- `appointments_scheduled_idx` trên `(scheduled_at)` với `where deleted_at is null`
- `appointments_staff_scheduled_idx` trên `(staff_id, scheduled_at)` với `where deleted_at is null`
- `appointments_customer_scheduled_idx` trên `(customer_id, scheduled_at desc)` với `where deleted_at is null`
- `appointments_status_scheduled_idx` trên `(status, scheduled_at)` với `where deleted_at is null`

### 2. `public.appointment_services` (copy pattern `customer_services`)

- `appointment_id uuid not null references public.appointments(id) on delete cascade`
- `service_id uuid not null references public.services(id) on delete cascade`
- `primary key (appointment_id, service_id)`

### 3. `public.appointment_status_history`

- `id uuid primary key default gen_random_uuid()`
- `appointment_id uuid not null references public.appointments(id) on delete cascade`
- `from_status text null`
- `to_status text not null`
- `note text null`
- `changed_by uuid null references public.profiles(id) on delete set null`
- `changed_at timestamptz not null default now()`

Ghi tự động bằng trigger khi `status` đổi (Decision 7); chỉ grant `select, insert`.

## Status Mapping

### Customer stage

- `new_lead`
- `consulting`
- `deposited`
- `booked`
- `visited`
- `returning`
- `lost`

### Appointment status

- `pending_confirmation`
- `booked`
- `checked_in`
- `completed`
- `no_show`
- `cancelled`

### Ánh xạ từ trạng thái trên sheet Excel (để nhân viên thấy quen)

| Trên sheet | Trong CRM |
|---|---|
| Deposit (DP rồi, giờ còn "info") | `pending_confirmation` (`scheduled_at` có thể null) |
| Booking / Confirm / Belum Datang | `booked` |
| Sudah Datang | `checked_in` → `completed` khi chốt số cuối |
| Re schedule | sự kiện: đổi `scheduled_at`, status giữ `booked`, ghi history |
| Cancel / gajadi / Fail | `cancelled` (lý do ghi note) |
| Không đến, không báo | `no_show` |

## Main Flows

### 1. Lead -> Booking

1. Tạo / cập nhật customer từ nguồn lead.
2. Sales tư vấn và ghi note trên customer.
3. Khi khách chốt lịch, tạo `appointment`.
4. Nếu có cọc ngay, nhập `deposit_amount` trực tiếp trên appointment.
5. Đồng bộ stage của customer sang `booked` hoặc `deposited`.

### 2. Appointment Day

1. Lễ tân / sales mở danh sách lịch theo ngày.
2. Nếu khách đến, chuyển `appointment.status` sang `checked_in`.
3. Khi hoàn tất dịch vụ và chốt số cuối, cập nhật `final_amount` và chuyển `completed`; nếu có lịch tái hẹn (retouch/laser tiếp) tạo luôn appointment kế tiếp `pending_confirmation`.
4. Nếu khách xin đổi lịch, cập nhật `scheduled_at` (status giữ `booked`), trigger tự ghi history.
5. Nếu khách không đến, chuyển `no_show`.

### 2b. Cọc chưa có ngày (thay sheet DP CUS)

1. Khách chuyển DP nhưng chưa chốt ngày → tạo appointment `pending_confirmation` với `deposit_amount`, `scheduled_at = null`.
2. Tab "Chờ xếp lịch" liệt kê kèm ngày cọc; mỗi lần nhắc khách ghi `internal_note`.
3. Khách chốt ngày → điền `scheduled_at`, chuyển `booked`.

### 3. Customer Timeline

1. Từ customer mở ra lịch sử note hiện có.
2. Hiển thị thêm danh sách appointments theo thời gian giảm dần.
3. Mỗi appointment có timeline trạng thái + thông tin số tiền liên quan.
4. Từ đây có thể tạo lịch mới cho khách quay lại.

## UI Proposal

### 1. `/customers`

Giữ nguyên là màn hình hồ sơ khách / pipeline cơ bản, chỉ bổ sung:

- cột hoặc action `Đặt lịch`
- panel `Lịch hẹn gần nhất`
- tab hoặc dialog xem `Lịch sử lịch hẹn`

Không nên nhồi full lịch hẹn vào bảng customers vì sẽ làm loãng màn hình chính.

### 2. `/appointments`

Màn hình mới, mặc định mở **theo ngày (hôm nay)** — đúng cách nhân viên đang đọc sheet JANJI TEMU:

- bộ lọc: ngày, trạng thái, nhân viên (Sale), dịch vụ, nguồn — đúng các cột Jam/Service/Sale/Source trên sheet
- trong ngày, row nhóm theo trạng thái như sheet: Đã đến → Đã đặt lịch → Chờ xếp lịch → Hủy/No-show
- tab `Chờ xếp lịch`: các lịch `scheduled_at is null` (thay sheet DP CUS), kèm ngày cọc và note nhắc
- tab/filter `Sắp đến hạn tái hẹn`: `pending_confirmation` có ngày trong X ngày tới (thay cột "18/12 retouch" + "udh remind" của CS DATA)
- dòng tổng cuối ngày: tổng `final_amount` các lịch `completed` + số lịch — thay sheet REPORT thủ công
- toggle `Calendar / List`
- CTA `Tạo lịch hẹn`

List row hiển thị:

- giờ hẹn
- tên khách
- dịch vụ (nhiều tag, như customer)
- nhân viên phụ trách
- trạng thái
- cọc / giá chốt / còn nợ (Sisa — highlight khi > 0)
- action nhanh: check-in, dời lịch, hủy, hoàn tất, đặt lịch tái hẹn

### 3. Appointment Dialog / Drawer

Field tối thiểu:

- customer
- services (multi-select, tái dùng component sẵn có)
- scheduled date/time (được để trống = chờ xếp lịch)
- duration
- staff
- expected amount (Price)
- deposit amount (DP)
- final amount (Paid) + payment method (bank/cash/card)
- booking note
- internal note

### 4. Customer Detail / Timeline

Nếu repo chưa có trang detail riêng cho customer, có thể phase đầu mở bằng dialog hoặc drawer từ `/customers`.

## Risks / Trade-offs

- **Số tiền chỉ ở mức quản lý nội bộ**
  - Đơn giản, nhanh làm, hợp với nhu cầu hiện tại.
  - Trade-off là chưa phản ánh chi tiết nhiều lần thu/hoàn tiền; nếu phát sinh sẽ tách bảng riêng sau.

- **Stage customer và status appointment có thể lệch**
  - Đây là rủi ro có thật nếu update rời rạc.
  - Giảm thiểu bằng cách chỉ cho phép một số action chuẩn cập nhật cả hai cùng lúc.

- **Nhiều lần thu tiền gộp vào 1 số `final_amount`**
  - Đủ cho thống kê ngày và công nợ cơ bản; chi tiết từng đợt trả nằm trong note.
  - Trade-off là chưa query được lịch sử thu theo đợt; tách bảng payment khi thành nhu cầu thật.

- **Không chặn trùng giờ / double-booking**
  - Lễ tân tự nhìn danh sách ngày như đang làm với sheet.
  - Nếu sau này cần, thêm cảnh báo mềm khi cùng `staff_id` trùng khung giờ.

- **RLS đang khá mở**
  - Đồng nhất với current repo nên ít rủi ro tích hợp.
  - Nhưng về dài hạn có thể cần siết theo vai trò `sales / reception / admin`.

- **Chỉ có 1 chi nhánh**
  - Không thêm `branch_id`, không thêm tầng phân quyền hay lọc theo cơ sở.
  - Trade-off là nếu sau này mở chi nhánh thứ 2 thì phải mở rộng schema và UI lúc đó.

## Migration Plan

1. Thêm migration mới cho 3 bảng `appointments`, `appointment_services`, `appointment_status_history` (kèm check constraint status).
2. Bật RLS + grant tường minh cho `authenticated` (history chỉ `select, insert`).
3. Reuse `public.set_updated_at()` cho `appointments`; thêm trigger ghi `appointment_status_history` khi status đổi.
4. Tạo page `/appointments` đọc dữ liệu tương tự pattern `/customers` (view theo ngày + tab Chờ xếp lịch).
5. Thêm action từ `/customers` để mở dialog tạo lịch hẹn cho một khách.
6. Admin thêm value nguồn `cs_lama` (và Facebook/Pancake nếu cần) vào `enum_options` — không cần code.

## Open Questions

- Có cần lưu `assigned_sales_id` riêng với `staff_id` của appointment không?
- Có cần auto tạo reminder records khi appointment được tạo, hay làm ở phase 2?
