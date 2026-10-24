import Link from "next/link";
import { Button } from "antd";
import { getTranslations } from "next-intl/server";

import { ErrorState } from "@/components/common/error-state";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <ErrorState status="404" title={t("notFoundTitle")} message={t("notFoundBody")}>
      <Link href="/">
        <Button>{t("backHome")}</Button>
      </Link>
    </ErrorState>
  );
}
