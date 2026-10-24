import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentProfile } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Giữ trạng thái thu gọn sidebar qua lần tải lại (chống nhấp nháy SSR).
  const cookieStore = await cookies();
  const collapsed = cookieStore.get("sidebar_state")?.value === "false";

  // Proxy đã đảm bảo đã đăng nhập; lấy hồ sơ để hiện tên + link admin.
  const profile = await getCurrentProfile();

  return (
    <AppShell
      defaultCollapsed={collapsed}
      isAdmin={profile?.role === "admin"}
      userName={profile?.user_name || profile?.email}
      avatarUrl={profile?.avatar_url}
    >
      {children}
    </AppShell>
  );
}
