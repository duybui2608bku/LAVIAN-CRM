import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import type { AppointmentStaff } from "@/components/appointments/appointments-manager";
import { RemindersCalendar } from "@/components/reminders/reminders-calendar";
import { REMINDERS_ENABLED } from "@/lib/reminders";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import type { ReminderWithCustomer } from "@/types/reminder";

// Lịch nhắc hẹn dạng calendar. `?date=YYYY-MM-DD` (link từ thông báo) chọn sẵn ngày.
export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  if (!REMINDERS_ENABLED) notFound();
  const [{ date }, t, supabase] = await Promise.all([searchParams, getTranslations("reminders"), createClient()]);
  const [reminders, staffRes] = await Promise.all([
    fetchAll<ReminderWithCustomer>((from, to) =>
      supabase
        .from("customer_reminders")
        .select(
          "id, customer_id, remind_at, note, done_at, created_by, created_at, " +
            "customer:customers(id, full_name, phone, thread, staff_id)",
        )
        .order("remind_at", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: ReminderWithCustomer[] | null; error: { message: string } | null }>,
    ),
    supabase.from("profiles").select("id, user_name, avatar_url, department, status").order("user_name"),
  ]);

  return (
    <RemindersCalendar
      title={t("title")}
      reminders={reminders}
      staff={(staffRes.data as AppointmentStaff[]) ?? []}
      initialDate={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined}
    />
  );
}
