import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { LeadForm } from "@/components/lead-form/lead-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { CUSTOMER_OPTIONS } from "@/lib/customer-options";
import { CARE_DEPARTMENTS } from "@/types/user";

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
  const [{ data: staff }, { data: services }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, user_name, avatar_url")
      .eq("status", "active")
      .in("department", CARE_DEPARTMENTS)
      .neq("user_name", "")
      .order("user_name"),
    admin
      .from("services")
      // Cả dịch vụ đã tắt: lịch sử lịch hẹn cũ vẫn hiện đúng tên.
      .select("id, name_vi, name_en, name_id, is_active")
      .order("sort_order"),
  ]);

  return (
    <main className="flex min-h-svh justify-center p-3">
      <div className="w-full max-w-lg">
        {/* useSearchParams trong LeadForm cần Suspense boundary */}
        <Suspense>
          <LeadForm
            staff={staff ?? []}
            services={services ?? []}
            stages={CUSTOMER_OPTIONS.filter((o) => o.kind === "stage")}
            ratings={CUSTOMER_OPTIONS.filter((o) => o.kind === "rating")}
          />
        </Suspense>
      </div>
    </main>
  );
}
