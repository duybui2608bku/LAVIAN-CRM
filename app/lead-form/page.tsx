import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { LeadForm } from "@/components/lead-form/lead-form";
import { Logo } from "@/components/layout/logo";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EnumOption } from "@/types/customer";

// Trang public (không cần đăng nhập) — nhúng iframe vào SMAX hoặc mở trực tiếp.

// Khách chưa từng chọn theme → mặc định light. Script nằm sau script của
// next-themes trong body nên gỡ được class dark trước khi vẽ; ghi vào
// localStorage "theme" để next-themes hydrate đúng và ThemeToggle hoạt động.
const forceLightDefault = `try{if(!localStorage.theme){localStorage.theme="light";document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light"}}catch(e){}`;

export async function generateMetadata() {
  const t = await getTranslations("leadForm");
  return { title: t("title") };
}

export default async function LeadFormPage() {
  const t = await getTranslations("leadForm");
  // Trang anonymous nên đọc profiles/enum_options bằng admin client
  // (RLS chỉ cho authenticated).
  const admin = createAdminClient();
  const [{ data: staff }, { data: stages }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, user_name")
      .eq("status", "active")
      .neq("user_name", "")
      .order("user_name"),
    admin
      .from("enum_options")
      .select("*")
      .eq("kind", "stage")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  return (
    <main className="relative flex min-h-svh items-center justify-center p-4">
      <script dangerouslySetInnerHTML={{ __html: forceLightDefault }} />
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo className="size-10" />
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {/* useSearchParams trong LeadForm cần Suspense boundary */}
        <Suspense>
          <LeadForm
            staff={staff ?? []}
            stages={(stages ?? []) as EnumOption[]}
          />
        </Suspense>
      </div>
    </main>
  );
}
