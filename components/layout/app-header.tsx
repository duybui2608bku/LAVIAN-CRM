import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";

import avatarFallback from "@/app/assets/avt.webp";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { signOut } from "@/lib/actions/auth";

export async function AppHeader({
  userName,
  avatarUrl,
}: {
  userName?: string;
  avatarUrl?: string | null;
}) {
  const t = await getTranslations();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" aria-label={t("nav.toggleSidebar")} />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
      <span className="font-semibold">{t("common.appName")}</span>
      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <LanguageSwitcher />
        {userName && (
          <>
            <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
            {/* eslint-disable-next-line @next/next/no-img-element -- avatar_url là host tuỳ ý, tránh cấu hình remotePatterns */}
            <img
              src={avatarUrl || avatarFallback.src}
              alt=""
              className="size-7 shrink-0 rounded-full object-cover"
            />
            <span className="max-w-[12rem] truncate text-sm text-muted-foreground">
              {userName}
            </span>
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                title={t("auth.signOut")}
                aria-label={t("auth.signOut")}
              >
                <LogOut className="size-4" />
              </Button>
            </form>
          </>
        )}
      </div>
    </header>
  );
}
