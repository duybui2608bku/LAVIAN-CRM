import { getTranslations } from "next-intl/server";

import { MarketingStats } from "@/components/dashboard/marketing-stats";

export default async function Home() {
  const t = await getTranslations("dashboard");

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <MarketingStats />
    </div>
  );
}
