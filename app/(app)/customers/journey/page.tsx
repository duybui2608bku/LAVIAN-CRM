import { JourneyDueTable, type DueRow } from "@/components/cards/journey-due";
import type { StaffRef } from "@/components/common/user-avatar";
import { requirePermission } from "@/lib/auth";
import { journeyDue } from "@/lib/cards";
import { todayUtc7 } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import type { CardItem } from "@/types/card";
import type { Tour } from "@/types/tour";
import { TELESALES_DEPARTMENTS } from "@/types/user";

type Source = {
  cards: { id: string; customer_id: string; cancelled_at: null; items: Pick<CardItem, "id" | "service_id" | "sessions" | "refunded_at" | "service">[] }[];
  tours: Pick<Tour, "card_item_id" | "tour_date" | "service_detail" | "service_session">[];
  customers: DueRow["customer"][];
} | null;

/** Đầu hôm nay theo UTC+7 (VN / WIB) — lịch hẹn từ lúc này trở đi = "Đã hẹn". */
const todayStart = () => `${todayUtc7()}T00:00:00+07:00`;

/**
 * Khách hàng → Đến hạn liệu trình (Telesales gọi khách — sếp chốt 2026-11-22).
 * Telesales không có quyền đọc thẻ / tour → lấy qua RPC `journey_due_source` (security definer, không trả tiền),
 * tính `journeyDue` ở server, chỉ gửi dòng cần gọi xuống client.
 */
export default async function JourneyPage() {
  const profile = await requirePermission("customers.view");
  const db = await createClient();
  const [source, services, staff] = await Promise.all([
    db.rpc("journey_due_source", { p_since: todayStart() }),
    db.from("services").select("id,name"),
    db.from("profiles").select("id,user_name,avatar_url,status,department").order("user_name"),
  ]);
  for (const result of [source, services, staff]) if (result.error) throw new Error(result.error.message);

  const src = source.data as Source;
  const customers = new Map(src?.customers.map((c) => [c.id, c]));
  const serviceName = new Map((services.data ?? []).map((s) => [s.id as string, s.name as string]));
  const rows: DueRow[] = journeyDue(src?.cards ?? [], src?.tours ?? []).flatMap((d) => {
    const customer = customers.get(d.card.customer_id);
    return customer ? [{
      key: `${d.item.id}:${d.task}`, customer, task: d.task, n: d.n, due: d.due,
      service: serviceName.get(d.item.service_id) ?? "—", last: d.last,
    }] : [];
  });

  return <JourneyDueTable rows={rows} staff={(staff.data ?? []) as StaffRef[]}
    me={{ id: profile.id, telesales: TELESALES_DEPARTMENTS.includes(profile.department ?? "") }} />;
}
