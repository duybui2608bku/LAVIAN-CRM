import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SmaxReportView } from "@/components/customers/smax-report-view";
import { Page, PageHeader } from "@/components/layout/page";
import { getCurrentProfile } from "@/lib/auth";

export default async function SmaxReportPage() {
  const profile = await getCurrentProfile();
  if (!profile?.permissions.includes("customers.view")) redirect("/");
  const t = await getTranslations("nav");

  return (
    <Page>
      <PageHeader title={t("smaxReport")} />
      <SmaxReportView />
    </Page>
  );
}
