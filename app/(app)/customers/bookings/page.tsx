import { getTranslations } from "next-intl/server";

import { BOOKING_PAGE_STAGES } from "@/lib/customer-options";
import { CustomersView } from "../customers-view";

// Booking management: chỉ khách đang ở stage Booking hoặc Deposited.
export default async function BookingsPage() {
  const t = await getTranslations("customers");
  return <CustomersView stages={BOOKING_PAGE_STAGES} title={t("bookingsTitle")} />;
}
