"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Briefcase,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  SlidersHorizontal,
  UserCog,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/layout/logo";
import { ENUM_KINDS } from "@/types/customer";

// Chỉ giữ mục có trang thật. Thêm dần khi dựng tính năng.
const items = [
  { key: "dashboard", href: "/", icon: LayoutDashboard },
  { key: "customers", href: "/customers", icon: Users },
  { key: "appointments", href: "/appointments", icon: CalendarDays },
] as const;

export function AppSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tEnums = useTranslations("enums");

  // Mục quản trị chỉ hiện với admin.
  const navItems = isAdmin
    ? [
        ...items,
        { key: "marketing", href: "/marketing", icon: Megaphone } as const,
        { key: "users", href: "/users", icon: UserCog } as const,
        { key: "services", href: "/services", icon: Briefcase } as const,
      ]
    : items;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex h-16 items-center gap-3 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white">
            <Logo className="size-8" />
          </div>
          <span className="truncate text-sm font-semibold tracking-[0.08em] group-data-[collapsible=icon]:hidden">
            LAVIAN <span className="text-primary">CRM</span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3 py-5 group-data-[collapsible=icon]:px-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5 group-data-[collapsible=icon]:items-center">
              {navItems.map(({ key, href, icon: Icon }) => {
                const active =
                  href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <SidebarMenuItem key={key}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={t(key)}
                      className="h-10 gap-3 rounded-lg px-3 font-medium data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                    >
                      <Link href={href}>
                        <Icon className="size-[18px]" />
                        <span>{t(key)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Danh mục (admin): menu cha + menu con theo kind. Sub tự ẩn khi
                  sidebar thu gọn icon — mục cha vẫn điều hướng được. */}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/enums")}
                    tooltip={t("enums")}
                    className="h-10 gap-3 rounded-lg px-3 font-medium data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                  >
                    <Link href="/enums/stage">
                      <SlidersHorizontal className="size-[18px]" />
                      <span>{t("enums")}</span>
                    </Link>
                  </SidebarMenuButton>
                  <SidebarMenuSub className="mx-5 gap-1 py-1">
                    {ENUM_KINDS.map((kind) => (
                      <SidebarMenuSubItem key={kind}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === `/enums/${kind}`}
                        >
                          <Link href={`/enums/${kind}`}>
                            <span>{tEnums(`kind_${kind}`)}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
