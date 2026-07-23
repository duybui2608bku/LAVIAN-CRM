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

export function sanitizeCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/^0+(?=\d)/, "");
}
