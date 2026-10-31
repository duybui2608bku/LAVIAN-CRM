export function normalizePhone(value: string): string {
  return value.replace(/\+/g, "").trim();
}
