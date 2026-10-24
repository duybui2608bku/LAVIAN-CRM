"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTopLoader } from "nextjs-toploader";
import { useTransition } from "react";
import { Select } from "antd";

import { LocaleFlag } from "@/components/common/locale-flag";
import { setLocale } from "@/i18n/actions";
import { localeLabels, locales, type Locale } from "@/i18n/config";

const OPTIONS = locales.map((l) => ({
  value: l,
  label: (
    <span className="flex items-center gap-2">
      <LocaleFlag locale={l} />
      {localeLabels[l]}
    </span>
  ),
}));

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common");
  const current = useLocale() as Locale;
  const loader = useTopLoader();
  const [pending, startTransition] = useTransition();

  // Đổi ngôn ngữ chạy revalidatePath("/", "layout") → re-render toàn bộ server
  // components, khá lâu. Chạy thanh top-loader để có phản hồi trực quan.
  return (
    <Select
      value={current}
      loading={pending}
      disabled={pending}
      aria-label={t("language")}
      options={OPTIONS}
      popupMatchSelectWidth={false}
      placement="bottomRight"
      className={className}
      onChange={(v) =>
        startTransition(async () => {
          loader.start();
          try {
            await setLocale(v);
          } finally {
            loader.done();
          }
        })
      }
    />
  );
}
