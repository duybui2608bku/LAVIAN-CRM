import { redirect } from "next/navigation";

import { Page } from "@/components/layout/page";
import { TelesalesReportView } from "@/components/reports/telesales-report-view";
import { getCurrentProfile } from "@/lib/auth";

export default async function TelesalesReportPage() {
  const profile = await getCurrentProfile();
  if (!profile?.permissions.includes("telesales.view")) redirect("/");

  return (
    <Page>
      <TelesalesReportView />
    </Page>
  );
}
