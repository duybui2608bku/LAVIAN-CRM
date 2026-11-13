import { redirect } from "next/navigation";

import { Page } from "@/components/layout/page";
import { ReportsView } from "@/components/reports/reports-view";
import { getCurrentProfile } from "@/lib/auth";

export default async function ReportsPage() {
  const profile = await getCurrentProfile();
  if (!profile?.permissions.includes("reports.view")) redirect("/");

  return (
    <Page>
      <ReportsView />
    </Page>
  );
}
