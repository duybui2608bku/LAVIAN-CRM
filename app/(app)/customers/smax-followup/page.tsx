import { redirect } from "next/navigation";

import { SmaxFollowupView } from "@/components/customers/smax-followup-view";
import { Page } from "@/components/layout/page";
import { getCurrentProfile } from "@/lib/auth";

export default async function SmaxFollowupPage() {
  const profile = await getCurrentProfile();
  if (!profile?.permissions.includes("customers.view")) redirect("/");

  return (
    <Page>
      <SmaxFollowupView />
    </Page>
  );
}
