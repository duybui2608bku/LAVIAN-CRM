import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/layout/logo";

export default async function LoginPage() {
  const t = await getTranslations("auth");

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="surface w-full max-w-md space-y-7 p-7 sm:p-9">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="mb-2 flex size-14 items-center justify-center rounded-lg bg-white ring-1 ring-border">
            <Logo className="size-11" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{t("loginTitle")}</h1>
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">
            {t("loginSubtitle")}
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
