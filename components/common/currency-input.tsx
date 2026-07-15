"use client";

import { LocaleFlag } from "@/components/common/locale-flag";
import type { Locale } from "@/i18n/config";
import { formatVnd, sanitizeCurrencyInput, VND_CURRENCY } from "@/lib/currency";
import { cn } from "@/lib/utils";

export function CurrencyInput({
  value,
  locale,
  className,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> & {
  value: string;
  locale: Locale;
  onValueChange: (value: string) => void;
}) {
  const digits = sanitizeCurrencyInput(value);
  const display = digits ? formatVnd(Number(digits)) : "";

  return (
    <div className="relative">
      <LocaleFlag
        locale={locale}
        className="absolute top-1/2 left-2.5 h-4 w-6 -translate-y-1/2"
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        {VND_CURRENCY}
      </span>
      <input
        {...props}
        type="text"
        inputMode="numeric"
        data-slot="input"
        value={display}
        onChange={(e) => onValueChange(sanitizeCurrencyInput(e.target.value))}
        className={cn(
          "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-14 pl-11 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className,
        )}
      />
    </div>
  );
}
