"use client";

import { InputNumber } from "antd";

import { sanitizeCurrencyInput } from "@/lib/currency";

/** Ô tiền IDR (định dạng 1.000.000, cho phép số âm khi `min` < 0) — dùng chung mọi form tiền. */
export function MoneyInput(props: { value?: number | null; onChange?: (v: number | null) => void; min?: number; className?: string; ariaLabel?: string; size?: "small" }) {
  return <InputNumber<number> className={props.className ?? "w-full"} min={props.min ?? 0} precision={0} controls={false} placeholder="Rp"
    inputMode="numeric" aria-label={props.ariaLabel} value={props.value} onChange={props.onChange} size={props.size}
    formatter={(v) => (v == null || `${v}` === "" ? "" : Number(v).toLocaleString("id-ID"))}
    parser={(v) => {
      const neg = (v ?? "").trim().startsWith("-");
      const n = Number(sanitizeCurrencyInput(v ?? ""));
      return (neg ? -n : n) as unknown as number;
    }} />;
}
