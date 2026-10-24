import type { Customer, EnumOption } from "@/types/customer";
import type { Service } from "@/types/service";

/** Nhãn của một option theo locale hiện tại (fallback tiếng Việt). */
export function optionLabel(
  opt: Pick<EnumOption, "label_vi" | "label_en" | "label_id">,
  locale: string,
): string {
  if (locale === "en") return opt.label_en || opt.label_vi;
  if (locale === "id") return opt.label_id || opt.label_vi;
  return opt.label_vi;
}

/** Tên dịch vụ theo locale hiện tại (fallback tiếng Việt — cùng quy tắc optionLabel). */
export function serviceName(
  s: Pick<Service, "name_vi" | "name_en" | "name_id">,
  locale: string,
): string {
  if (locale === "en") return s.name_en || s.name_vi;
  if (locale === "id") return s.name_id || s.name_vi;
  return s.name_vi;
}

/** Chuẩn hoá để so khớp lỏng: chữ thường, bỏ dấu cách/ký tự đặc biệt. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Khớp một giá trị nguồn thô (vd. `platform` SMAX "instagram") với danh mục
 * Nguồn: trùng value hoặc nhãn vi/en/id (không phân biệt hoa thường, ký tự
 * đặc biệt). Trả `value` của option, không khớp → null.
 */
export function resolveSource(
  raw: string | null | undefined,
  options: Pick<EnumOption, "value" | "label_vi" | "label_en" | "label_id">[],
): string | null {
  const key = norm(raw ?? "");
  if (!key) return null;
  const hit = options.find((o) =>
    [o.value, o.label_vi, o.label_en, o.label_id].some((v) => v && norm(v) === key),
  );
  return hit?.value ?? null;
}

export interface CustomerFilters {
  search?: string;
  stage?: string;
  source?: string;
  staffId?: string;
  salesId?: string;
  technicianId?: string;
  serviceId?: string; // khách có gắn dịch vụ này
  from?: string; // YYYY-MM-DD — created_at >= from
  to?: string; // YYYY-MM-DD — created_at <= to (theo ngày)
}

/**
 * Vị từ lọc khách hàng phía client. Tách thuần để test được.
 * ponytail: so khoảng ngày theo NGÀY UTC (cắt 10 ký tự đầu ISO) — đủ cho bộ lọc,
 *           tránh lệ thuộc timezone.
 */
export function matchesCustomerFilters(
  c: Customer,
  f: CustomerFilters,
): boolean {
  const q = (f.search ?? "").trim().toLowerCase();
  if (q) {
    const hay = `${c.full_name} ${c.phone}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.stage && c.stage !== f.stage) return false;
  if (f.source && c.source !== f.source) return false;
  if (f.staffId && c.staff_id !== f.staffId) return false;
  if (f.salesId && c.sales_id !== f.salesId) return false;
  if (f.technicianId && c.technician_id !== f.technicianId) return false;
  if (f.serviceId && !c.service_ids?.includes(f.serviceId)) return false;

  const day = c.created_at.slice(0, 10);
  if (f.from && day < f.from) return false;
  if (f.to && day > f.to) return false;

  return true;
}
