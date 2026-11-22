import { cardMe, loadCards } from "@/app/(app)/cards/data";
import { CardsView } from "@/components/cards/cards-view";
import type { StaffRef } from "@/components/common/user-avatar";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Service } from "@/types/service";

// Menu Thẻ liệu trình: danh sách thẻ + drawer chi tiết (dịch vụ, thanh toán, lộ trình tour). Thẻ bán ở Sales Management.
export default async function CardsPage() {
  const db = await createClient();
  const [profile, data, services, staff] = await Promise.all([
    getCurrentProfile(),
    loadCards(db),
    db.from("services").select("*").order("sort_order"),
    db.from("profiles").select("id,user_name,avatar_url,status,department").order("user_name"),
  ]);
  if (!profile) throw new Error("Bạn cần đăng nhập.");
  for (const result of [services, staff]) if (result.error) throw new Error(result.error.message);
  return <CardsView {...data} me={cardMe(profile)}
    services={(services.data ?? []) as Service[]} staff={(staff.data ?? []) as StaffRef[]} />;
}
