export const IDR_CURRENCY = "IDR";
export const RUPIAH_LABEL = "RP";

export function formatRupiah(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: IDR_CURRENCY,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Dạng rút gọn cho chỗ hẹp (tâm biểu đồ tròn): 6.333.333 → "Rp 6,3 jt". */
export function formatRupiahCompact(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: IDR_CURRENCY,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function sanitizeCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/^0+(?=\d)/, "");
}
