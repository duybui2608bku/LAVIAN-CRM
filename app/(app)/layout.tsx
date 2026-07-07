import { cookies } from "next/headers";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentProfile } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Giữ trạng thái thu gọn sidebar qua lần tải lại (chống nhấp nháy SSR).
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  // Proxy đã đảm bảo đã đăng nhập; lấy hồ sơ để hiện tên + link admin.
  const profile = await getCurrentProfile();

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar isAdmin={profile?.role === "admin"} />
      <SidebarInset>
        <AppHeader
          userName={profile?.user_name || profile?.email}
          avatarUrl={profile?.avatar_url}
        />
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
