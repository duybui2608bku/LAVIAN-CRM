export const locales = ["en", "vi"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "vi";

export const LOCALE_COOKIE = "NEXT_LOCALE";

// Tên hiển thị (endonym) — không cần dịch theo locale.
export const localeLabels: Record<Locale, string> = {
  en: "English",
  vi: "Tiếng Việt",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
