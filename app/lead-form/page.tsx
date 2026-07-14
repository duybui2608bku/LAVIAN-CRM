import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { LeadForm } from "@/components/lead-form/lead-form";
import { Logo } from "@/components/layout/logo";

// Trang public (không cần đăng nhập) — nhúng iframe vào SMAX hoặc mở trực tiếp.

export async function generateMetadata() {
  const t = await getTranslations("leadForm");
  return { title: t("title") };
}

export default async function LeadFormPage() {
  const t = await getTranslations("leadForm");

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo className="size-10" />
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {/* useSearchParams trong LeadForm cần Suspense boundary */}
        <Suspense>
          <LeadForm />
        </Suspense>
      </div>
    </main>
  );
}
