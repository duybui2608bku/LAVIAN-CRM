"use client";

import { Input } from "antd";

import { LocaleFlag } from "@/components/common/locale-flag";
import { formatRupiah, RUPIAH_LABEL, sanitizeCurrencyInput } from "@/lib/currency";

/**
 * Ô nhập tiền Rupiah: lưu chuỗi chữ số ("" = trống), hiển thị đã format.
 * Cờ ID + nhãn RP qua prefix/suffix của antd Input. Dùng được trong Form.Item.
 */
export function CurrencyInput({
  value,
  onChange,
  id,
  placeholder,
  disabled,
  autoFocus,
  className,
}: {
  value?: string;
  onChange?: (value: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const digits = sanitizeCurrencyInput(value ?? "");
  return (
    <Input
      id={id}
      inputMode="numeric"
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      className={className}
      prefix={<LocaleFlag locale="id" />}
      suffix={<span className="text-xs font-medium text-muted-foreground">{RUPIAH_LABEL}</span>}
      value={digits ? formatRupiah(Number(digits)) : ""}
      onChange={(e) => onChange?.(sanitizeCurrencyInput(e.target.value))}
    />
  );
}
