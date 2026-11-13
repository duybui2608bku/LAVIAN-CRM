import data from "./id-regions.json";

// Dữ liệu 2 cấp (tỉnh → huyện/thành phố) Indonesia, nguồn cahyadsn/wilayah (MIT),
// Kepmendagri No 300.2.2-2138/2025. Mã: tỉnh "31", huyện/TP "31.71".
type Row = [code: string, name: string, cities: [code: string, name: string][]];
type Option = { value: string; label: string };

const rows = data as Row[];

export const PROVINCES: Option[] = rows.map(([value, label]) => ({ value, label }));

const CITIES = new Map<string, Option[]>(
  rows.map(([code, , cities]) => [code, cities.map(([value, label]) => ({ value, label }))]),
);

export const citiesOf = (provinceCode: string): Option[] => CITIES.get(provinceCode) ?? [];

/** Tên tỉnh + huyện/TP từ mã ("31" | "31.71"); mã lạ → null. */
export function regionNames(code: string | null | undefined) {
  if (!code) return null;
  const province = PROVINCES.find((p) => p.value === code.slice(0, 2))?.label;
  if (!province) return null;
  const city = code.length > 2 ? citiesOf(code.slice(0, 2)).find((c) => c.value === code)?.label : undefined;
  return { province, city };
}
