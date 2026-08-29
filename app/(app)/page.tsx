import { getTranslations } from "next-intl/server";

import { MarketingStats } from "@/components/dashboard/marketing-stats";
import { Page } from "@/components/layout/page";

export default async function Home() {
  const t = await getTranslations("dashboard");

  return (
    <Page>
      <MarketingStats
        showFinancials
        header={{ title: t("title"), description: t("description") }}
      />
    </Page>
  );
}
