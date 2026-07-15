"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTopLoader } from "nextjs-toploader";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { LocaleFlag } from "@/components/common/locale-flag";
import { setLocale } from "@/i18n/actions";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common");
  const current = useLocale() as Locale;
  const loader = useTopLoader();
  const [pending, startTransition] = useTransition();

  // Đổi ngôn ngữ chạy revalidatePath("/", "layout") → re-render toàn bộ server
  // components, khá lâu. Chạy đúng thanh top-loader để có phản hồi trực quan.
  return (
    <Select
      value={current}
      disabled={pending}
      onValueChange={(v) =>
        startTransition(async () => {
          loader.start();
          try {
            await setLocale(v as Locale);
          } finally {
            loader.done();
          }
        })
      }
    >
      <SelectTrigger
        size="sm"
        aria-label={t("language")}
        className={cn("gap-2", className)}
      >
        {/* Render trực tiếp theo locale hiện tại — đúng ngay từ SSR, không phụ
            thuộc việc Radix phản chiếu ItemText (options nằm trong portal đóng). */}
        <span className="flex items-center gap-2">
          <LocaleFlag locale={current} />
          {localeLabels[current]}
        </span>
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {locales.map((l) => (
          <SelectItem key={l} value={l} className="cursor-pointer">
            <span className="flex items-center gap-2">
              <LocaleFlag locale={l} />
              {localeLabels[l]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
