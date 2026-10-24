import { Button } from "antd";
import { getTranslations } from "next-intl/server";

import { ErrorState } from "@/components/common/error-state";
import { signOut } from "@/lib/actions/auth";

export default async function BannedPage() {
  const t = await getTranslations("auth");

  return (
    <main className="flex min-h-svh">
      <ErrorState status="403" title={t("bannedTitle")} message={t("bannedBody")}>
        <form action={signOut}>
          <Button htmlType="submit">{t("signOut")}</Button>
        </form>
      </ErrorState>
    </main>
  );
}
