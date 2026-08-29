import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { MarketingStats } from "@/components/dashboard/marketing-stats";
import { Page } from "@/components/layout/page";
import { getCurrentProfile } from "@/lib/auth";

export default async function MarketingPage() {
  const [profile, t] = await Promise.all([
    getCurrentProfile(),
    getTranslations("dashboard"),
  ]);

  if (profile?.role !== "admin") redirect("/");

  return (
    <Page>
      <MarketingStats
        showSpend
        header={{ title: t("title"), description: t("description") }}
      />
    </Page>
  );
}
