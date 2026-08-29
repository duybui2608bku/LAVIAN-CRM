"use client";

import { LocaleFlag } from "@/components/common/locale-flag";
import { Input } from "@/components/ui/input";
import { formatRupiah, RUPIAH_LABEL, sanitizeCurrencyInput } from "@/lib/currency";
import { cn } from "@/lib/utils";

// Dựng trên <Input> để chiều cao/viền/nền luôn khớp mọi field khác; ở đây chỉ
// thêm cờ + nhãn RP hai bên và chừa padding cho chúng.
export function CurrencyInput({
  value,
  className,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const digits = sanitizeCurrencyInput(value);
  const display = digits ? formatRupiah(Number(digits)) : "";

  return (
    <div className="relative">
      <LocaleFlag
        locale="id"
        className="absolute top-1/2 left-2.5 h-4 w-6 -translate-y-1/2"
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
        {RUPIAH_LABEL}
      </span>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) => onValueChange(sanitizeCurrencyInput(e.target.value))}
        className={cn("pr-14 pl-11", className)}
      />
    </div>
  );
}
