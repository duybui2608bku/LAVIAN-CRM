import type { Customer, EnumOption } from "@/types/customer";
import type { Service } from "@/types/service";

/** Nhãn của một option theo locale hiện tại (fallback tiếng Việt). */
export function optionLabel(
  opt: Pick<EnumOption, "label_vi" | "label_en" | "label_id">,
  locale: string,
): string {
  if (locale === "en") return opt.label_en || opt.label_vi;
  return opt.label_vi;
}

/** Tên dịch vụ theo locale hiện tại (fallback tiếng Việt — cùng quy tắc optionLabel). */
export function serviceName(
  s: Pick<Service, "name_vi" | "name_en" | "name_id">,
  locale: string,
): string {
  if (locale === "en") return s.name_en || s.name_vi;
  return s.name_vi;
}

/**
 * Tìm theo tên hoặc SĐT. SĐT so theo chữ số (bỏ "-", "62" đầu = "0") nên gõ
 * "081212" hay "+62812" vẫn khớp "0812-1214-1243".
 */
export function matchesNameOrPhone(name: string, phone: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (`${name} ${phone}`.toLowerCase().includes(q)) return true;
  const digits = (v: string) => v.replace(/\D/g, "").replace(/^62/, "0");
  const qd = digits(q);
  return qd.length >= 3 && digits(phone).includes(qd);
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
  if (!matchesNameOrPhone(c.full_name, c.phone, f.search ?? "")) return false;
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
