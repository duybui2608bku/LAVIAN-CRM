import { getTranslations } from "next-intl/server";

import avatarFallback from "@/app/assets/avt.webp";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export async function AppHeader({
  userName,
  avatarUrl,
}: {
  userName?: string;
  avatarUrl?: string | null;
}) {
  const t = await getTranslations();

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b bg-card/90 px-4 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur-xl sm:px-6">
      <SidebarTrigger
        className="-ml-1 size-9 rounded-lg border bg-background shadow-xs"
        aria-label={t("nav.toggleSidebar")}
      />
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-6" />
      <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">
        {t("common.appName")}
      </span>
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <LanguageSwitcher />
        {userName && (
          <>
            <Separator orientation="vertical" className="mx-1 hidden data-[orientation=vertical]:h-6 sm:block" />
            {/* eslint-disable-next-line @next/next/no-img-element -- avatar_url là host tuỳ ý, tránh cấu hình remotePatterns */}
            <img
              src={avatarUrl || avatarFallback.src}
              alt=""
              className="size-8 shrink-0 rounded-full border-2 border-card object-cover ring-1 ring-border"
            />
            <span className="hidden max-w-[12rem] truncate text-sm font-medium text-foreground md:inline">
              {userName}
            </span>
            <SignOutButton />
          </>
        )}
      </div>
    </header>
  );
}
