"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button, Drawer, Dropdown, Layout, Menu, Segmented, Switch, type MenuProps } from "antd";
import {
  Briefcase,
  CalendarDays,
  ChartColumn,
  Check,
  ChevronsUpDown,
  Languages,
  LayoutGrid,
  LogOut,
  Megaphone,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  UserCog,
  UserPen,
  Users,
  Wallet,
} from "lucide-react";

import { useConfirm } from "@/components/common/confirm-action";
import { useSwitchLocale } from "@/components/common/language-switcher";
import { LocaleFlag } from "@/components/common/locale-flag";
import { UserAvatar } from "@/components/common/user-avatar";
import { Logo } from "@/components/layout/logo";
import { ProfileDialog } from "@/components/layout/profile-dialog";
import { useMounted } from "@/hooks/use-mounted";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

// Cookie giữ trạng thái thu gọn qua lần tải lại (layout server đọc lại → không nháy).
const COLLAPSE_COOKIE = "sidebar_state";

// Chỉ giữ mục có trang thật. Thêm dần khi dựng tính năng.
const ITEMS = [
  { key: "customers", href: "/customers", icon: Users },
  { key: "appointments", href: "/appointments", icon: CalendarDays },
  { key: "tour", href: "/tour", icon: Wallet },
] as const;

const ADMIN_ITEMS = [
  { key: "reports", href: "/reports", icon: ChartColumn },
  { key: "marketing", href: "/marketing", icon: Megaphone },
  { key: "users", href: "/users", icon: UserCog },
  { key: "services", href: "/services", icon: Briefcase },
] as const;

// Staff (role ≠ admin) chỉ thấy 2 mục này — proxy.ts chặn các route còn lại.
const STAFF_ITEMS = [ITEMS[0], ADMIN_ITEMS[3]] as const;

type NavItem = (typeof ITEMS)[number] | (typeof ADMIN_ITEMS)[number];

type Account = { userName?: string; avatarUrl?: string | null };

/**
 * Khung app. Desktop (≥ md): sidebar kiểu Linear/Attio (logo, menu chia nhóm, tài khoản ở đáy).
 * Điện thoại: như app — thanh trên (logo + avatar), thanh tab dưới (3 trang chính + Menu),
 * "Menu" mở bottom sheet chứa mục quản trị + tài khoản.
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
  children: React.ReactNode;
} & Account) {
  const t = useTranslations();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const openProfile = () => setProfileOpen(true);

  const toggle = () => {
    setCollapsed(!collapsed);
    document.cookie = `${COLLAPSE_COOKIE}=${collapsed}; path=/; max-age=31536000`;
  };

  const all: readonly NavItem[] = isAdmin ? [...ITEMS, ...ADMIN_ITEMS] : STAFF_ITEMS;
  const selected = all.find((i) => pathname.startsWith(i.href))?.href ?? pathname;
  const toMenu = (items: readonly NavItem[]) =>
    items.map(({ key, href, icon: Icon }) => ({
      key: href,
      icon: <Icon className="size-4" />,
      label: <Link href={href}>{t(`nav.${key}`)}</Link>,
    }));

  const menuItems = (compact: boolean): MenuProps["items"] => {
    if (!isAdmin) return toMenu(STAFF_ITEMS);
    // Thu gọn: tiêu đề nhóm không đọc được → thay bằng vạch ngăn.
    if (compact) return [...toMenu(ITEMS), { type: "divider" }, ...toMenu(ADMIN_ITEMS)];
    return [
      { type: "group", key: "main", label: t("nav.groupMain"), children: toMenu(ITEMS) },
      { type: "group", key: "admin", label: t("nav.groupAdmin"), children: toMenu(ADMIN_ITEMS) },
    ];
  };

  const brand = (
    <span className="truncate text-sm font-semibold tracking-wide text-foreground">
      LAVIAN <span className="text-primary">CRM</span>
    </span>
  );
  const logo = (
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-border">
      <Logo className="size-7" />
    </span>
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
        <div className="flex h-full flex-col">
          <Link href="/customers" className="flex h-14 shrink-0 items-center gap-2.5 px-4">
            {logo}
            {!collapsed && brand}
          </Link>
          <Menu
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={[selected]}
            items={menuItems(collapsed)}
            className="min-h-0 flex-1 overflow-y-auto border-0! py-2"
          />
          <div className={collapsed ? "flex flex-col items-center gap-1 p-2" : "flex items-center gap-1 p-2"}>
            <AccountMenu
              compact={collapsed}
              userName={userName}
              avatarUrl={avatarUrl}
              onProfile={openProfile}
            />
            <Button
              type="text"
              aria-label={t("nav.toggleSidebar")}
              title={t("nav.toggleSidebar")}
              icon={collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
              onClick={toggle}
            />
          </div>
        </div>
      </Layout.Sider>

      <Layout className="min-w-0">
        {/* Điện thoại: thanh trên kiểu app — logo + tên, avatar mở Menu. */}
        <header className="sticky top-0 z-30 border-b border-border bg-card/90 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
          <div className="flex h-13 items-center gap-2.5 px-4">
            <Link href="/customers" className="flex min-w-0 items-center gap-2.5">
              {logo}
              {brand}
            </Link>
            <button
              type="button"
              aria-label={t("common.account")}
              onClick={() => setSheetOpen(true)}
              className="ms-auto flex size-10 items-center justify-center rounded-full active:bg-muted"
            >
              <UserAvatar src={avatarUrl} size={30} />
            </button>
          </div>
        </header>

        {/* Chừa chỗ cho thanh tab dưới trên điện thoại. */}
        <Layout.Content className="flex flex-col max-md:pb-[calc(4rem+env(safe-area-inset-bottom))]">
          {children}
        </Layout.Content>
      </Layout>

      <BottomTabs
        items={isAdmin ? ITEMS : STAFF_ITEMS}
        pathname={pathname}
        menuActive={sheetOpen || (isAdmin && ADMIN_ITEMS.some((i) => pathname.startsWith(i.href)))}
        onMenu={() => setSheetOpen(true)}
      />
      <MenuSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        isAdmin={isAdmin}
        pathname={pathname}
        userName={userName}
        avatarUrl={avatarUrl}
        onProfile={openProfile}
      />
      <ProfileDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        userName={userName}
        avatarUrl={avatarUrl}
      />
    </Layout>
  );
}

/** Thanh tab dưới (chỉ điện thoại): các trang chính + Menu. Chạm bằng ngón cái. */
function BottomTabs({
  items,
  pathname,
  menuActive,
  onMenu,
}: {
  items: readonly NavItem[];
  pathname: string;
  menuActive: boolean;
  onMenu: () => void;
}) {
  const t = useTranslations("nav");
  const tab = (active: boolean, Icon: typeof Users, label: string) => (
    <>
      <span
        className={cn(
          "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
          active && "bg-primary/12",
        )}
      >
        <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
      </span>
      <span className={cn("text-[11px] leading-none", active && "font-semibold")}>{label}</span>
    </>
  );
  const cls = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-1 select-none transition-colors",
      active ? "text-primary" : "text-muted-foreground active:text-foreground",
    );

  return (
    <nav
      aria-label="Menu"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="flex h-16 items-stretch">
        {items.map(({ key, href, icon }) => {
          const active = !menuActive && pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cls(active)}>
              {tab(active, icon, t(key))}
            </Link>
          );
        })}
        <button type="button" onClick={onMenu} className={cls(menuActive)}>
          {tab(menuActive, LayoutGrid, t("more"))}
        </button>
      </div>
    </nav>
  );
}

/** Bottom sheet "Menu" (điện thoại): mục quản trị + tài khoản, giao diện tối, ngôn ngữ, đăng xuất. */
function MenuSheet({
  open,
  onClose,
  isAdmin,
  pathname,
  userName,
  avatarUrl,
  onProfile,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  pathname: string;
  onProfile: () => void;
} & Account) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { isDark, setDark } = useDarkMode();
  const { pending, switchTo } = useSwitchLocale();
  const confirmSignOut = useSignOut();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="bottom"
      size="auto"
      closable={false}
      rootClassName="md:hidden"
      classNames={{ section: "rounded-t-2xl", body: "p-0!" }}
    >
      <div className="flex flex-col gap-4 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <span className="mx-auto h-1 w-10 rounded-full bg-border" aria-hidden />

        <div className="flex items-center gap-3">
          <UserAvatar src={avatarUrl} size={44} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{userName}</p>
            <p className="text-xs text-muted-foreground">{t("common.account")}</p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">{t("nav.groupAdmin")}</p>
            <div className="grid grid-cols-3 gap-2">
              {ADMIN_ITEMS.map(({ key, href, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-colors active:bg-muted",
                      active ? "border-primary bg-primary/8 text-primary" : "border-border text-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                    {t(`nav.${key}`)}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="surface divide-y divide-border">
          <button
            type="button"
            onClick={() => {
              onClose();
              onProfile();
            }}
            className="flex min-h-12 w-full items-center gap-3 px-3 text-left active:bg-muted"
          >
            <UserPen className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm">{t("auth.myProfile")}</span>
          </button>
          <label className="flex min-h-12 items-center gap-3 px-3">
            <Moon className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm">{t("common.darkMode")}</span>
            <Switch checked={isDark} onChange={setDark} />
          </label>
          <div className="flex min-h-12 items-center gap-3 px-3 py-2">
            <Languages className="size-4 text-muted-foreground" />
            <span className="flex-1 text-sm">{t("common.language")}</span>
            <Segmented
              size="small"
              value={locale}
              disabled={pending}
              onChange={(v) => v !== locale && switchTo(v as Locale)}
              options={locales.map((l) => ({
                value: l,
                label: <span className="flex items-center gap-1.5 px-1"><LocaleFlag locale={l} />{l.toUpperCase()}</span>,
                title: localeLabels[l],
              }))}
            />
          </div>
        </div>

        <Button danger block size="large" icon={<LogOut className="size-4" />} onClick={confirmSignOut}>
          {t("auth.signOut")}
        </Button>
      </div>
    </Drawer>
  );
}

function useDarkMode() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = useMounted() && resolvedTheme === "dark";
  return { isDark, setDark: (dark: boolean) => setTheme(dark ? "dark" : "light") };
}

/**
 * Hỏi rồi đăng xuất. Sau khi huỷ phiên thì tải lại cứng `/login`: modal xác nhận
 * (sống ở root layout), menu và cache React Query của phiên cũ đều bị xoá.
 */
function useSignOut() {
  const t = useTranslations("auth");
  const confirm = useConfirm();
  return () =>
    confirm({
      title: t("signOutConfirmTitle"),
      content: t("signOutConfirmBody"),
      okText: t("signOut"),
      cancelText: t("cancel"),
      onOk: async () => {
        await signOut();
        window.location.replace("/login");
        // Giữ nút OK loading tới khi trang mới thay thế (không đóng modal sớm).
        await new Promise(() => {});
      },
    });
}

/** Avatar + tên ở đáy sidebar (desktop) → menu: giao diện tối, ngôn ngữ, đăng xuất. */
function AccountMenu({
  compact,
  userName,
  avatarUrl,
  onProfile,
}: { compact: boolean; onProfile: () => void } & Account) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { isDark, setDark } = useDarkMode();
  const { pending, switchTo } = useSwitchLocale();
  const confirmSignOut = useSignOut();

  const items: MenuProps["items"] = [
    {
      key: "profile",
      icon: <UserPen className="size-4" />,
      label: t("auth.myProfile"),
    },
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
    if (key === "profile") onProfile();
    else if (key === "theme") setDark(!isDark);
    else if (key.startsWith("lang:")) {
      const next = key.slice(5) as Locale;
      if (next !== locale) switchTo(next);
    } else if (key === "signout") confirmSignOut();
  };

  return (
    <Dropdown trigger={["click"]} placement={compact ? "topLeft" : "top"} menu={{ items, onClick }}>
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
