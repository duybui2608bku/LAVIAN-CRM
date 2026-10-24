"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Divider, Layout, Menu, type MenuProps } from "antd";
import {
  Briefcase,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  PanelLeft,
  SlidersHorizontal,
  UserCog,
  Users,
} from "lucide-react";

import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { UserAvatar } from "@/components/common/user-avatar";
import { Logo } from "@/components/layout/logo";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ENUM_KINDS } from "@/types/customer";

// Cookie giữ trạng thái thu gọn qua lần tải lại (layout server đọc lại → không nháy).
const COLLAPSE_COOKIE = "sidebar_state";

// Chỉ giữ mục có trang thật. Thêm dần khi dựng tính năng.
const ITEMS = [
  { key: "dashboard", href: "/", icon: LayoutDashboard },
  { key: "customers", href: "/customers", icon: Users },
  { key: "appointments", href: "/appointments", icon: CalendarDays },
] as const;

const ADMIN_ITEMS = [
  { key: "marketing", href: "/marketing", icon: Megaphone },
  { key: "users", href: "/users", icon: UserCog },
  { key: "services", href: "/services", icon: Briefcase },
] as const;

/** Khung app: Sider (menu điều hướng) + Header (theme, ngôn ngữ, user). */
export function AppShell({
  defaultCollapsed,
  isAdmin,
  userName,
  avatarUrl,
  children,
}: {
  defaultCollapsed: boolean;
  isAdmin: boolean;
  userName?: string;
  avatarUrl?: string | null;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = (next: boolean) => {
    setCollapsed(next);
    document.cookie = `${COLLAPSE_COOKIE}=${!next}; path=/; max-age=31536000`;
  };

  const navItems = isAdmin ? [...ITEMS, ...ADMIN_ITEMS] : ITEMS;
  const menuItems: MenuProps["items"] = navItems.map(({ key, href, icon: Icon }) => ({
    key: href,
    icon: <Icon className="size-4" />,
    label: <Link href={href}>{t(`nav.${key}`)}</Link>,
  }));
  // Danh mục (admin): menu cha + menu con theo kind.
  if (isAdmin)
    menuItems.push({
      key: "/enums",
      icon: <SlidersHorizontal className="size-4" />,
      label: t("nav.enums"),
      children: ENUM_KINDS.map((kind) => ({
        key: `/enums/${kind}`,
        label: <Link href={`/enums/${kind}`}>{t(`enums.kind_${kind}`)}</Link>,
      })),
    });

  const selected =
    pathname === "/"
      ? "/"
      : (navItems.find((i) => i.href !== "/" && pathname.startsWith(i.href))?.href ??
        pathname);

  return (
    <Layout className="min-h-svh">
      <Layout.Sider
        collapsible
        collapsed={collapsed}
        onCollapse={toggle}
        trigger={null}
        breakpoint="md"
        width={232}
        className="sticky top-0 h-svh border-r border-border"
      >
        <Link
          href="/"
          className="flex h-14 items-center gap-2.5 border-b border-border px-4"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded bg-white">
            <Logo className="size-7" />
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-[0.08em] text-foreground">
              LAVIAN <span className="text-primary">CRM</span>
            </span>
          )}
        </Link>
        <Menu
          mode="inline"
          selectedKeys={[selected]}
          defaultOpenKeys={pathname.startsWith("/enums") ? ["/enums"] : []}
          items={menuItems}
          className="border-0 px-1 py-3"
        />
      </Layout.Sider>

      <Layout className="min-w-0">
        <Layout.Header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border">
          <Button
            type="text"
            icon={<PanelLeft className="size-4" />}
            aria-label={t("nav.toggleSidebar")}
            onClick={() => toggle(!collapsed)}
          />
          <span className="hidden text-sm font-semibold sm:inline">
            {t("common.appName")}
          </span>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
            {userName && (
              <>
                <Divider orientation="vertical" className="hidden sm:block" />
                <UserAvatar src={avatarUrl} size={28} />
                <span className="hidden max-w-48 truncate text-sm font-medium md:inline">
                  {userName}
                </span>
                <SignOutButton />
              </>
            )}
          </div>
        </Layout.Header>
        <Layout.Content className="flex flex-col">{children}</Layout.Content>
      </Layout>
    </Layout>
  );
}
