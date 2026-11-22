import type { CardMe } from "@/components/cards/card-drawer";
import type { CurrentProfile } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import type { createClient } from "@/lib/supabase/server";
import { CARD_FIELDS, type TreatmentCard } from "@/types/card";
import { TOUR_FIELDS, type Tour } from "@/types/tour";

/**
 * Thẻ liệu trình + tour gắn thẻ — dùng chung trang /cards và Sales Management.
 * ponytail: tải hết thẻ (vài trăm thẻ vẫn nhẹ); nhiều nghìn thẻ → lọc theo khoảng ngày ở server.
 */
export async function loadCards(db: Awaited<ReturnType<typeof createClient>>) {
  const [cards, tours] = await Promise.all([
    db.from("treatment_cards").select(CARD_FIELDS).order("created_at", { ascending: false }),
    db.from("tours").select(TOUR_FIELDS).not("card_item_id", "is", null).is("deleted_at", null),
  ]);
  if (cards.error) throw new Error(cards.error.message);
  if (tours.error) throw new Error(tours.error.message);
  return { cards: (cards.data ?? []) as unknown as TreatmentCard[], cardTours: (tours.data ?? []) as unknown as Tour[] };
}

/** Quyền thẻ + quyền tour (mở drawer tour từ lộ trình) của user hiện tại. */
export function cardMe(profile: CurrentProfile): CardMe {
  const isAdmin = profile.role === "admin";
  const can = (p: Permission) => profile.permissions.includes(p);
  return {
    id: profile.id, isAdmin, canEdit: can("cards.edit"), canCancel: isAdmin && can("cards.delete"),
    tour: {
      id: profile.id, isAdmin, isTechnician: !isAdmin && profile.department === "technician",
      canEdit: can("tour.edit"), canDelete: can("tour.delete"),
    },
  };
}
