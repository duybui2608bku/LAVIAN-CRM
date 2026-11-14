import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ErrorState } from "@/components/common/error-state";
import { getCurrentProfile } from "@/lib/auth";
import { homePath } from "@/lib/permissions";

// Trang chủ = menu đầu tiên được phép; không có quyền nào thì báo.
export default async function Home() {
  const profile = await getCurrentProfile();
  const path = homePath(profile?.permissions ?? []);
  if (path) redirect(path);
  const t = await getTranslations("common");
  return <ErrorState status="403" title={t("noAccessTitle")} message={t("noAccessBody")} />;
}
