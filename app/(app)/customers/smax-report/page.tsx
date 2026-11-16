import { redirect } from "next/navigation";

import { SmaxReportView } from "@/components/customers/smax-report-view";
import { Page } from "@/components/layout/page";
import { getCurrentProfile } from "@/lib/auth";

export default async function SmaxReportPage() {
  const profile = await getCurrentProfile();
  if (!profile?.permissions.includes("customers.view")) redirect("/");

  return (
    <Page>
      <SmaxReportView />
    </Page>
  );
}
