import { redirect } from "next/navigation";

import { AdsStatsView } from "@/components/marketing/ads-stats";
import { Page } from "@/components/layout/page";
import { getCurrentProfile } from "@/lib/auth";

export default async function MarketingPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/");

  return (
    <Page>
      <AdsStatsView />
    </Page>
  );
}
