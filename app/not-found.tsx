import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common/error-state";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <ErrorState title={t("notFoundTitle")} message={t("notFoundBody")}>
      <Button asChild variant="outline">
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </ErrorState>
  );
}
