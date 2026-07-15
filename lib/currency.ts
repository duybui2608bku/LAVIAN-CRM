export const VND_CURRENCY = "VND";

export function formatVnd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value)} đ`;
}

export function sanitizeCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/^0+(?=\d)/, "");
}
