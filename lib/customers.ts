import type { Customer, EnumOption } from "@/types/customer";
import type { Service } from "@/types/service";

/** Nhãn của một option theo locale hiện tại (fallback tiếng Việt). */
export function optionLabel(opt: EnumOption, locale: string): string {
  if (locale === "en") return opt.label_en || opt.label_vi;
  if (locale === "id") return opt.label_id || opt.label_vi;
  return opt.label_vi;
}

/** Tên dịch vụ theo locale hiện tại (fallback tiếng Việt — cùng quy tắc optionLabel). */
export function serviceName(s: Service, locale: string): string {
  if (locale === "en") return s.name_en || s.name_vi;
  if (locale === "id") return s.name_id || s.name_vi;
  return s.name_vi;
}

export interface CustomerFilters {
  search?: string;
  stage?: string;
  source?: string;
  staffId?: string;
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
  if (f.serviceId && !c.service_ids?.includes(f.serviceId)) return false;

  const day = c.created_at.slice(0, 10);
  if (f.from && day < f.from) return false;
  if (f.to && day > f.to) return false;

  return true;
}
