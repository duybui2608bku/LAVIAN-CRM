"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { setLocale } from "@/i18n/actions";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

// Cờ SVG nội tuyến cho 3 locale — tránh thêm dependency chỉ vì vài lá cờ.
// size-full để không bị class của SelectItem ép svg về size-4.
const flags: Record<Locale, React.ReactElement> = {
  vi: (
    <svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" className="size-full">
      <rect width="30" height="20" fill="#da251d" />
      <polygon
        fill="#ff0"
        points="15,4 16.41,8.06 20.71,8.15 17.28,10.74 18.53,14.85 15,12.4 11.47,14.85 12.72,10.74 9.29,8.15 13.59,8.06"
      />
    </svg>
  ),
  en: (
    <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" className="size-full">
      <clipPath id="uk-t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path
        d="M0,0 L60,30 M60,0 L0,30"
        clipPath="url(#uk-t)"
        stroke="#c8102e"
        strokeWidth="4"
      />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  ),
  id: (
    <svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" className="size-full">
      <rect width="30" height="10" fill="#ff0000" />
      <rect y="10" width="30" height="10" fill="#fff" />
    </svg>
  ),
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common");
  const current = useLocale() as Locale;
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={current}
      disabled={pending}
      onValueChange={(v) => startTransition(() => setLocale(v as Locale))}
    >
      <SelectTrigger
        size="sm"
        aria-label={t("language")}
        className={cn("gap-2", className)}
      >
        {/* Render trực tiếp theo locale hiện tại — đúng ngay từ SSR, không phụ
            thuộc việc Radix phản chiếu ItemText (options nằm trong portal đóng). */}
        <span className="flex items-center gap-2">
          <span className="flex h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-border/60">
            {flags[current]}
          </span>
          {localeLabels[current]}
        </span>
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {locales.map((l) => (
          <SelectItem key={l} value={l} className="cursor-pointer">
            <span className="flex items-center gap-2">
              <span className="flex h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-border/60">
                {flags[l]}
              </span>
              {localeLabels[l]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
