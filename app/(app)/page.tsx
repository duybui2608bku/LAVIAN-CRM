import { getTranslations } from "next-intl/server";

import { MarketingStats } from "@/components/dashboard/marketing-stats";

export default async function Home() {
  const t = await getTranslations("dashboard");

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <MarketingStats
        showFinancials
        header={{ title: t("title"), description: t("description") }}
      />
    </div>
  );
}
