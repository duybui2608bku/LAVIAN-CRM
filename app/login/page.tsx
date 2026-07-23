import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/layout/logo";

export default async function LoginPage() {
  const t = await getTranslations("auth");

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-4">
      <div className="absolute -top-32 right-[-8rem] size-96 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute -bottom-40 left-[-8rem] size-96 rounded-full bg-info/10 blur-3xl" />
      <div className="relative w-full max-w-md space-y-7 rounded-3xl border bg-card/95 p-7 shadow-[0_24px_80px_rgba(31,41,55,0.14)] backdrop-blur sm:p-9">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-border">
            <Logo className="size-11" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("loginTitle")}</h1>
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">
            {t("loginSubtitle")}
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
