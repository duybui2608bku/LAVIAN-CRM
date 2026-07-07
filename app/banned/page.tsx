import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export default async function BannedPage() {
  const t = await getTranslations("auth");

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <ShieldAlert className="mx-auto size-12 text-destructive" />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{t("bannedTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("bannedBody")}</p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            {t("signOut")}
          </Button>
        </form>
      </div>
    </main>
  );
}
