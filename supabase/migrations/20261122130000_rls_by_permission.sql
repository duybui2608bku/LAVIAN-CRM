-- Mục đích: RLS các bảng nghiệp vụ theo QUYỀN BỘ PHẬN (department_permissions) thay cho "mọi nhân viên active".
--   Trước đây quyền chỉ chặn ở proxy + server action; ai có JWT gọi thẳng REST vẫn đọc/ghi mọi bảng
--   (customers còn `using (true)` — cả user bị khoá cũng đọc được). Giờ DB tự chặn theo cùng key quyền với app,
--   admin chỉnh ở /users → "Phân quyền" thì RLS tự theo.
-- Thứ tự: SAU 20261122120000_department_permissions_matrix.sql. Chạy lại an toàn (create or replace / drop policy if exists).
-- Không đụng: profiles, department_permissions, documents*, notifications (đã có policy riêng);
--   lead form công khai dùng secret key (bỏ qua RLS); trigger ghi chéo bảng đều SECURITY DEFINER.
--
-- Tóm tắt (đọc / ghi):
--   customers                 : quyền khách | lịch hẹn | thẻ | báo cáo   — chỉ có quyền tour → chỉ khách có tour
--                               ghi: khách | lịch hẹn | cards.edit (RPC bán thẻ đổi stage) ; xoá cứng: customers.delete | appointments.edit
--   clinic_appointments, logs : quyền khách | lịch hẹn | thẻ | báo cáo     ; ghi: appointments.edit | appointments.delete
--   appointment_performers    : như lịch hẹn                              ; ghi: appointments.edit
--   needs, portrait, chat summary, reminders: người xem hồ sơ 360° (customers.view/edit, appointments.view/edit);
--                               reminders ghi: customers.edit
--   tours                     : tour.* | cards.* | reports.view           ; tạo: tour.edit | cards.edit ; sửa: tour.edit | tour.delete
--   treatment_cards/items/payments: cards.*                               ; ghi: cards.edit (huỷ thẻ: cards.delete)
--   services, service_groups  : ai đăng nhập cũng đọc                    ; thêm/sửa: services.edit ; xoá: services.delete
--   ảnh B/A (bảng + storage)  : can_access_ba_photos() = như cũ (trừ Telesales) VÀ có quyền xem hồ sơ 360°

-- 1. Hàm kiểm quyền ------------------------------------------------------------------------------
-- true nếu user đang đăng nhập active VÀ (admin HOẶC bộ phận có ít nhất 1 key trong `keys`).
-- SECURITY INVOKER: chỉ đọc profiles + department_permissions (authenticated đã đọc được) → không leo quyền.
-- Trong policy luôn gọi dạng `(select public.has_permission(...))` để Postgres tính 1 lần / câu lệnh.
-- ponytail: policy `*_write` dạng `for all` cũng áp cho SELECT → advisor báo "multiple permissive policies"
-- (thêm 1 phép kiểm boolean / truy vấn, không đáng kể). Tách insert/update/delete nếu bảng lớn lên.
create or replace function public.has_permission(variadic keys text[])
returns boolean
language sql
stable
security invoker
set search_path = ''
as $fn$
  select exists (
    select 1
    from public.profiles p
    left join public.department_permissions dp on dp.department = p.department
    where p.id = (select auth.uid())
      and p.status = 'active'
      and (p.role = 'admin' or dp.permissions && keys)
  );
$fn$;
revoke execute on function public.has_permission(text[]) from public, anon;
grant execute on function public.has_permission(text[]) to authenticated;

-- Ảnh B/A: giữ luật cũ (mọi bộ phận trừ Telesales) + phải có quyền xem hồ sơ 360° (KTV chỉ có tour → không xem).
create or replace function public.can_access_ba_photos()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select public.has_permission('customers.view', 'customers.edit', 'appointments.view', 'appointments.edit')
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and (role = 'admin' or department is null or department::text not in ('telesales', 'telesales_leader'))
    );
$fn$;

-- 2. Khách hàng -----------------------------------------------------------------------------------
drop policy if exists customers_all on public.customers;
drop policy if exists customers_read on public.customers;
drop policy if exists customers_insert on public.customers;
drop policy if exists customers_update on public.customers;
drop policy if exists customers_delete on public.customers;
-- ponytail: người chỉ có quyền tour thấy MỌI khách có tour (kể cả tour của KTV khác) — siết "tour của mình +
-- tour chờ nhận" nếu cần, nhưng khi đó bộ phận không phải KTV có tour.view sẽ mất tên khách trên bảng tour.
create policy customers_read on public.customers for select to authenticated using (
  (select public.has_permission('customers.view', 'customers.edit', 'customers.delete', 'appointments.view',
    'appointments.edit', 'appointments.delete', 'cards.view', 'cards.edit', 'reports.view', 'telesales.view'))
  or ((select public.has_permission('tour.view'))
    and exists (select 1 from public.tours t where t.customer_id = customers.id and t.deleted_at is null))
);
create policy customers_insert on public.customers for insert to authenticated
  with check ((select public.has_permission('customers.edit', 'appointments.edit')));
-- Sửa: ghi chú nhanh ở hồ sơ 360° (người xem), xoá mềm (customers.delete), RPC bán thẻ đổi stage (cards.edit).
create policy customers_update on public.customers for update to authenticated
  using ((select public.has_permission('customers.view', 'customers.edit', 'customers.delete',
    'appointments.view', 'appointments.edit', 'cards.edit')))
  with check ((select public.has_permission('customers.view', 'customers.edit', 'customers.delete',
    'appointments.view', 'appointments.edit', 'cards.edit')));
-- Xoá cứng: tạo lịch thất bại thì gỡ khách vừa tạo nhanh (appointments.edit).
create policy customers_delete on public.customers for delete to authenticated
  using ((select public.has_permission('customers.delete', 'appointments.edit')));

-- 3. Lịch hẹn + log + người thực hiện ----------------------------------------------------------------
drop policy if exists clinic_appointments_staff on public.clinic_appointments;
drop policy if exists clinic_appointments_read on public.clinic_appointments;
drop policy if exists clinic_appointments_write on public.clinic_appointments;
create policy clinic_appointments_read on public.clinic_appointments for select to authenticated using (
  (select public.has_permission('customers.view', 'customers.edit', 'appointments.view', 'appointments.edit',
    'appointments.delete', 'cards.view', 'cards.edit', 'reports.view', 'telesales.view')));
-- authenticated không có quyền DELETE trên bảng này → "all" chỉ mở insert/update.
create policy clinic_appointments_write on public.clinic_appointments for all to authenticated
  using ((select public.has_permission('appointments.edit', 'appointments.delete')))
  with check ((select public.has_permission('appointments.edit', 'appointments.delete')));

drop policy if exists clinic_appointment_logs_read on public.clinic_appointment_logs;
create policy clinic_appointment_logs_read on public.clinic_appointment_logs for select to authenticated using (
  (select public.has_permission('customers.view', 'customers.edit', 'appointments.view', 'appointments.edit',
    'appointments.delete', 'cards.view', 'cards.edit', 'reports.view', 'telesales.view')));

drop policy if exists appointment_performers_all on public.appointment_performers;
drop policy if exists appointment_performers_read on public.appointment_performers;
drop policy if exists appointment_performers_write on public.appointment_performers;
create policy appointment_performers_read on public.appointment_performers for select to authenticated using (
  (select public.has_permission('customers.view', 'customers.edit', 'appointments.view', 'appointments.edit',
    'appointments.delete', 'cards.view', 'cards.edit', 'reports.view', 'telesales.view')));
create policy appointment_performers_write on public.appointment_performers for all to authenticated
  using ((select public.has_permission('appointments.edit')))
  with check ((select public.has_permission('appointments.edit')));

-- 4. Hồ sơ 360°: nhu cầu, chân dung, tóm tắt chat, nhắc lịch -----------------------------------------
drop policy if exists customer_needs_select on public.customer_needs;
drop policy if exists customer_needs_insert on public.customer_needs;
drop policy if exists customer_needs_update on public.customer_needs;
create policy customer_needs_select on public.customer_needs for select to authenticated
  using ((select public.has_permission('customers.view', 'customers.edit', 'appointments.view', 'appointments.edit')));
create policy customer_needs_insert on public.customer_needs for insert to authenticated
  with check ((select public.has_permission('customers.view', 'customers.edit', 'appointments.view', 'appointments.edit')));
create policy customer_needs_update on public.customer_needs for update to authenticated
  using ((select public.has_permission('customers.view', 'customers.edit', 'appointments.view', 'appointments.edit')))
  with check ((select public.has_permission('customers.view', 'customers.edit', 'appointments.view', 'appointments.edit')));

drop policy if exists customer_portrait_entries_select on public.customer_portrait_entries;
drop policy if exists customer_portrait_entries_insert on public.customer_portrait_entries;
create policy customer_portrait_entries_select on public.customer_portrait_entries for select to authenticated
  using ((select public.has_permission('customers.view', 'customers.edit', 'appointments.view', 'appointments.edit')));
create policy customer_portrait_entries_insert on public.customer_portrait_entries for insert to authenticated
  with check (created_by = (select auth.uid())
    and (select public.has_permission('customers.view', 'customers.edit', 'appointments.view', 'appointments.edit')));

drop policy if exists customer_chat_summaries_select on public.customer_chat_summaries;
drop policy if exists customer_chat_summaries_insert on public.customer_chat_summaries;
drop policy if exists customer_chat_summaries_update on public.customer_chat_summaries;
create policy customer_chat_summaries_select on public.customer_chat_summaries for select to authenticated
  using ((select public.has_permission('customers.view', 'customers.edit', 'appointments.view', 'appointments.edit')));
create policy customer_chat_summaries_insert on public.customer_chat_summaries for insert to authenticated
  with check (created_by = (select auth.uid())
    and (select public.has_permission('customers.view', 'customers.edit', 'appointments.view', 'appointments.edit')));
create policy customer_chat_summaries_update on public.customer_chat_summaries for update to authenticated
  using ((select public.has_permission('customers.view', 'customers.edit', 'appointments.view', 'appointments.edit')))
  with check (created_by = (select auth.uid())
    and (select public.has_permission('customers.view', 'customers.edit', 'appointments.view', 'appointments.edit')));

drop policy if exists customer_reminders_all on public.customer_reminders;
drop policy if exists customer_reminders_read on public.customer_reminders;
drop policy if exists customer_reminders_write on public.customer_reminders;
create policy customer_reminders_read on public.customer_reminders for select to authenticated
  using ((select public.has_permission('customers.view', 'customers.edit', 'appointments.view', 'appointments.edit')));
create policy customer_reminders_write on public.customer_reminders for all to authenticated
  using ((select public.has_permission('customers.edit')))
  with check ((select public.has_permission('customers.edit')));

-- 5. Tour ------------------------------------------------------------------------------------------
drop policy if exists tours_staff on public.tours;
drop policy if exists tours_read on public.tours;
drop policy if exists tours_insert on public.tours;
drop policy if exists tours_update on public.tours;
create policy tours_read on public.tours for select to authenticated using (
  (select public.has_permission('tour.view', 'tour.edit', 'tour.delete', 'cards.view', 'cards.edit', 'reports.view')));
-- Tạo tour: từ thẻ liệu trình (cards.edit). Xoá tour = xoá mềm (update deleted_at, tour.delete); không có quyền DELETE.
create policy tours_insert on public.tours for insert to authenticated
  with check ((select public.has_permission('tour.edit', 'cards.edit')));
create policy tours_update on public.tours for update to authenticated
  using ((select public.has_permission('tour.edit', 'tour.delete')))
  with check ((select public.has_permission('tour.edit', 'tour.delete')));

-- 6. Thẻ liệu trình ---------------------------------------------------------------------------------
drop policy if exists treatment_cards_staff on public.treatment_cards;
drop policy if exists treatment_cards_read on public.treatment_cards;
drop policy if exists treatment_cards_write on public.treatment_cards;
create policy treatment_cards_read on public.treatment_cards for select to authenticated
  using ((select public.has_permission('cards.view', 'cards.edit', 'cards.delete')));
create policy treatment_cards_write on public.treatment_cards for all to authenticated
  using ((select public.has_permission('cards.edit', 'cards.delete')))
  with check ((select public.has_permission('cards.edit', 'cards.delete')));

drop policy if exists treatment_card_items_staff on public.treatment_card_items;
drop policy if exists treatment_card_items_read on public.treatment_card_items;
drop policy if exists treatment_card_items_write on public.treatment_card_items;
create policy treatment_card_items_read on public.treatment_card_items for select to authenticated
  using ((select public.has_permission('cards.view', 'cards.edit', 'cards.delete')));
create policy treatment_card_items_write on public.treatment_card_items for all to authenticated
  using ((select public.has_permission('cards.edit')))
  with check ((select public.has_permission('cards.edit')));

drop policy if exists treatment_card_payments_staff on public.treatment_card_payments;
drop policy if exists treatment_card_payments_read on public.treatment_card_payments;
drop policy if exists treatment_card_payments_write on public.treatment_card_payments;
create policy treatment_card_payments_read on public.treatment_card_payments for select to authenticated
  using ((select public.has_permission('cards.view', 'cards.edit', 'cards.delete')));
-- Xoá thanh toán nhập nhầm: app chỉ cho admin.
create policy treatment_card_payments_write on public.treatment_card_payments for all to authenticated
  using ((select public.has_permission('cards.edit')))
  with check ((select public.has_permission('cards.edit')));

-- 7. Dịch vụ: ai cũng đọc (giữ *_read), ghi theo quyền ----------------------------------------------
drop policy if exists services_write on public.services;
drop policy if exists services_insert on public.services;
drop policy if exists services_update on public.services;
drop policy if exists services_delete on public.services;
create policy services_insert on public.services for insert to authenticated
  with check ((select public.has_permission('services.edit')));
create policy services_update on public.services for update to authenticated
  using ((select public.has_permission('services.edit')))
  with check ((select public.has_permission('services.edit')));
create policy services_delete on public.services for delete to authenticated
  using ((select public.has_permission('services.delete')));

drop policy if exists service_groups_write on public.service_groups;
drop policy if exists service_groups_insert on public.service_groups;
drop policy if exists service_groups_update on public.service_groups;
drop policy if exists service_groups_delete on public.service_groups;
create policy service_groups_insert on public.service_groups for insert to authenticated
  with check ((select public.has_permission('services.edit')));
create policy service_groups_update on public.service_groups for update to authenticated
  using ((select public.has_permission('services.edit')))
  with check ((select public.has_permission('services.edit')));
create policy service_groups_delete on public.service_groups for delete to authenticated
  using ((select public.has_permission('services.delete')));

-- 8. Quyền bảng thừa: TRUNCATE bỏ qua RLS (xoá sạch bảng) — app không dùng TRUNCATE/TRIGGER/REFERENCES.
revoke truncate, trigger, references on public.customers, public.customer_reminders, public.department_permissions,
  public.profiles, public.services, public.service_groups from authenticated;

-- Kiểm tra nhanh (đăng nhập bằng tài khoản KTV trên app): menu chỉ còn Tour + Tài liệu, bảng tour vẫn hiện tên khách.
--   select polrelid::regclass, polname from pg_policy where polname like '%_staff' or polname like '%_all';  -- mong đợi: rỗng
