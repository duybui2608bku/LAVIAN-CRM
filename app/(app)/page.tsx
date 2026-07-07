import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

export default async function Home() {
  const t = await getTranslations();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("common.appName")}
      </h1>
      <p className="max-w-md text-muted-foreground">{t("home.tagline")}</p>
      <Button>{t("common.getStarted")}</Button>
    </div>
  );
}
