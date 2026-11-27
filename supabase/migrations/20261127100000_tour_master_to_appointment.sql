-- Mục đích: Master nhận tour (hoặc admin gán Master cho tour) → Master của lịch hẹn liên quan tự điền theo
--           (clinic_appointments.technician_id) — cột Nhân sự ở Quản lý bán hàng hiện đúng Master và đổi
--           "Đã thực hiện" không bị chặn vì thiếu Master.
--           Lịch liên quan = lịch đã bán thẻ chứa tour (treatment_cards.appointment_id) + lịch cùng khách, cùng ngày tour (giờ VN).
--           Chỉ điền khi lịch chưa có Master, hoặc đang là Master cũ của tour (đổi người nhận). Trả tour → giữ nguyên.
--           Security definer để Master không cần quyền appointments.edit.
-- Thứ tự chạy: sau 20261123140000_tour_roadmap_planned.sql (cột tours.planned).
-- Idempotent — chạy lại an toàn. Dán vào Supabase SQL Editor chạy tay.

create or replace function public.tours_fill_appointment_master()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.technician_id is not null and new.deleted_at is null and not new.planned then
    update public.clinic_appointments a
    set technician_id = new.technician_id
    where a.deleted_at is null
      and (a.id = (select c.appointment_id from public.treatment_card_items i
                   join public.treatment_cards c on c.id = i.card_id
                   where i.id = new.card_item_id)
        or (a.customer_id = new.customer_id
          and (a.scheduled_at at time zone 'Asia/Ho_Chi_Minh')::date = new.tour_date))
      and (a.technician_id is null
        or (tg_op = 'UPDATE' and a.technician_id = old.technician_id))
      and a.technician_id is distinct from new.technician_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.tours_fill_appointment_master() from public, anon, authenticated;

drop trigger if exists tours_fill_appointment_master on public.tours;
create trigger tours_fill_appointment_master
  after insert or update of technician_id on public.tours
  for each row execute function public.tours_fill_appointment_master();

-- Dữ liệu cũ: lịch chưa có Master → Master của tour gắn thẻ bán ở lịch đó, không có thì tour cùng khách cùng ngày
-- (nhiều tour → tour sớm nhất).
update public.clinic_appointments a
set technician_id = m.technician_id
from (
  select distinct on (appointment_id) appointment_id, technician_id
  from (
    select c.appointment_id, t.technician_id, 0 as prio, t.tour_date, t.created_at
    from public.tours t
    join public.treatment_card_items i on i.id = t.card_item_id
    join public.treatment_cards c on c.id = i.card_id
    where c.appointment_id is not null
      and t.technician_id is not null and t.deleted_at is null and not t.planned
    union all
    select a2.id, t.technician_id, 1, t.tour_date, t.created_at
    from public.tours t
    join public.clinic_appointments a2 on a2.customer_id = t.customer_id
      and (a2.scheduled_at at time zone 'Asia/Ho_Chi_Minh')::date = t.tour_date
    where t.technician_id is not null and t.deleted_at is null and not t.planned
  ) s
  order by appointment_id, prio, tour_date, created_at
) m
where a.id = m.appointment_id
  and a.technician_id is null
  and a.deleted_at is null;
