"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button, Drawer, Dropdown, Layout, Menu, Switch, type MenuProps } from "antd";
import {
  Briefcase,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Languages,
  ListTree,
  LogOut,
  Megaphone,
  Menu as MenuIcon,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

import { useConfirm } from "@/components/common/confirm-action";
import { useSwitchLocale } from "@/components/common/language-switcher";
import { LocaleFlag } from "@/components/common/locale-flag";
import { UserAvatar } from "@/components/common/user-avatar";
import { Logo } from "@/components/layout/logo";
import { useMounted } from "@/hooks/use-mounted";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { signOut } from "@/lib/actions/auth";

// Cookie giữ trạng thái thu gọn qua lần tải lại (layout server đọc lại → không nháy).
const COLLAPSE_COOKIE = "sidebar_state";

// Chỉ giữ mục có trang thật. Thêm dần khi dựng tính năng.
const ITEMS = [
  { key: "customers", href: "/customers", icon: Users },
  { key: "appointments", href: "/appointments", icon: CalendarDays },
  { key: "tour", href: "/tour", icon: Wallet },
] as const;

const ADMIN_ITEMS = [
  { key: "marketing", href: "/marketing", icon: Megaphone },
  { key: "users", href: "/users", icon: UserCog },
  { key: "services", href: "/services", icon: Briefcase },
  { key: "enums", href: "/enums", icon: ListTree },
] as const;

type NavItem = (typeof ITEMS)[number] | (typeof ADMIN_ITEMS)[number];

/**
 * Khung app kiểu Linear/Attio: sidebar (logo, menu chia nhóm, tài khoản ở đáy)
 * + nội dung. Desktop không có header; mobile có thanh trên mỏng mở menu.
 */
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
  // Mobile (< md): Sider ẩn hẳn, menu mở dạng Drawer đè lên nội dung.
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = () => {
    setCollapsed(!collapsed);
    document.cookie = `${COLLAPSE_COOKIE}=${collapsed}; path=/; max-age=31536000`;
  };

  const all: readonly NavItem[] = isAdmin ? [...ITEMS, ...ADMIN_ITEMS] : ITEMS;
  const selected = all.find((i) => pathname.startsWith(i.href))?.href ?? pathname;
  const toMenu = (items: readonly NavItem[]) =>
    items.map(({ key, href, icon: Icon }) => ({
      key: href,
      icon: <Icon className="size-4" />,
      label: <Link href={href}>{t(`nav.${key}`)}</Link>,
    }));

  const menuItems = (compact: boolean): MenuProps["items"] => {
    if (!isAdmin) return toMenu(ITEMS);
    // Thu gọn: tiêu đề nhóm không đọc được → thay bằng vạch ngăn.
    if (compact) return [...toMenu(ITEMS), { type: "divider" }, ...toMenu(ADMIN_ITEMS)];
    return [
      { type: "group", key: "main", label: t("nav.groupMain"), children: toMenu(ITEMS) },
      { type: "group", key: "admin", label: t("nav.groupAdmin"), children: toMenu(ADMIN_ITEMS) },
    ];
  };

  const nav = (compact: boolean, mobile = false) => (
    <div className="flex h-full flex-col">
      <Link
        href="/customers"
        className="flex h-14 shrink-0 items-center gap-2.5 px-4"
      >
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-border">
          <Logo className="size-7" />
        </span>
        {!compact && (
          <span className="truncate text-sm font-semibold tracking-wide text-foreground">
            LAVIAN <span className="text-primary">CRM</span>
          </span>
        )}
      </Link>
      <Menu
        mode="inline"
        inlineCollapsed={compact}
        selectedKeys={[selected]}
        items={menuItems(compact)}
        className="min-h-0 flex-1 overflow-y-auto border-0! py-2"
      />
      <div className={compact ? "flex flex-col items-center gap-1 p-2" : "flex items-center gap-1 p-2"}>
        <AccountMenu compact={compact} userName={userName} avatarUrl={avatarUrl} />
        {!mobile && (
          <Button
            type="text"
            aria-label={t("nav.toggleSidebar")}
            title={t("nav.toggleSidebar")}
            icon={
              collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )
            }
            onClick={toggle}
          />
        )}
      </div>
    </div>
  );

  return (
    <Layout className="min-h-svh">
      <Layout.Sider
        collapsed={collapsed}
        trigger={null}
        width={240}
        collapsedWidth={64}
        className="sticky! top-0 h-svh border-r border-border max-md:hidden!"
      >
        {nav(collapsed)}
      </Layout.Sider>

      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        placement="left"
        size={260}
        closable={false}
        styles={{ body: { padding: 0 } }}
      >
        {/* Bấm vào link nào cũng đóng drawer. */}
        <div
          className="h-full"
          onClick={(e) => (e.target as HTMLElement).closest("a") && setMobileOpen(false)}
        >
          {nav(false, true)}
        </div>
      </Drawer>

      <Layout className="min-w-0">
        {/* Chỉ mobile: thanh trên mỏng mở menu. */}
        <header className="sticky top-0 z-20 flex h-13 items-center gap-2 border-b border-border bg-card px-3 md:hidden">
          <Button
            type="text"
            icon={<MenuIcon className="size-5" />}
            aria-label={t("nav.toggleSidebar")}
            onClick={() => setMobileOpen(true)}
          />
          <span className="text-sm font-semibold tracking-wide">
            LAVIAN <span className="text-primary">CRM</span>
          </span>
        </header>
        <Layout.Content className="flex flex-col">{children}</Layout.Content>
      </Layout>
    </Layout>
  );
}

/** Avatar + tên ở đáy sidebar → menu: giao diện tối, ngôn ngữ, đăng xuất. */
function AccountMenu({
  compact,
  userName,
  avatarUrl,
}: {
  compact: boolean;
  userName?: string;
  avatarUrl?: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const confirm = useConfirm();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";
  const { pending, switchTo } = useSwitchLocale();

  const items: MenuProps["items"] = [
    {
      key: "theme",
      icon: <Moon className="size-4" />,
      label: (
        <span className="flex min-w-48 items-center justify-between gap-4">
          {t("common.darkMode")}
          <Switch size="small" checked={isDark} />
        </span>
      ),
    },
    {
      key: "lang",
      icon: <Languages className="size-4" />,
      label: t("common.language"),
      disabled: pending,
      children: locales.map((l) => ({
        key: `lang:${l}`,
        label: (
          <span className="flex min-w-36 items-center gap-2">
            <LocaleFlag locale={l} />
            {localeLabels[l]}
            {l === locale && <Check className="ml-auto size-4 text-primary" />}
          </span>
        ),
      })),
    },
    { type: "divider" },
    {
      key: "signout",
      danger: true,
      icon: <LogOut className="size-4" />,
      label: t("auth.signOut"),
    },
  ];

  const onClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "theme") setTheme(isDark ? "light" : "dark");
    else if (key.startsWith("lang:")) {
      const next = key.slice(5) as Locale;
      if (next !== locale) switchTo(next);
    } else if (key === "signout")
      confirm({
        title: t("auth.signOutConfirmTitle"),
        content: t("auth.signOutConfirmBody"),
        okText: t("auth.signOut"),
        cancelText: t("auth.cancel"),
        onOk: () => signOut(),
      });
  };

  return (
    <Dropdown
      trigger={["click"]}
      placement={compact ? "topLeft" : "top"}
      menu={{ items, onClick }}
    >
      <button
        type="button"
        aria-label={t("common.account")}
        title={userName}
        className={
          compact
            ? "flex size-9 items-center justify-center rounded-lg hover:bg-muted"
            : "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
        }
      >
        <UserAvatar src={avatarUrl} size={26} />
        {!compact && (
          <>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{userName}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>
    </Dropdown>
  );
}
