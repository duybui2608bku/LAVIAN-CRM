import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { LeadForm } from "@/components/lead-form/lead-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { CUSTOMER_OPTIONS } from "@/lib/customer-options";

// Trang public (không cần đăng nhập) — nhúng iframe vào SMAX hoặc mở trực tiếp.
// Luôn tiếng Anh (proxy.ts) + giao diện sáng (forcedTheme ở app/providers.tsx).

export async function generateMetadata() {
  const t = await getTranslations("leadForm");
  return { title: t("title") };
}

export default async function LeadFormPage() {
  // Trang anonymous nên đọc profiles/enum_options bằng admin client
  // (RLS chỉ cho authenticated).
  const admin = createAdminClient();
  const [{ data: staff }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, user_name")
      .eq("status", "active")
      .eq("department", "customer_care")
      .neq("user_name", "")
      .order("user_name"),
  ]);

  return (
    <main className="flex min-h-svh justify-center p-4">
      <div className="w-full max-w-lg">
        {/* useSearchParams trong LeadForm cần Suspense boundary */}
        <Suspense>
          <LeadForm
            staff={staff ?? []}
            stages={CUSTOMER_OPTIONS.filter((o) => o.kind === "stage")}
          />
        </Suspense>
      </div>
    </main>
  );
}
