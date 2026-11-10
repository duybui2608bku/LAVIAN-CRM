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
 * Số WhatsApp của Lavian đã nhận tin, rút gọn "WA-<2 số cuối>".
 * Lấy từ page id trong link hội thoại SMAX: `.../chats/waw<số>?tid=...`.
 * Không phải hội thoại WhatsApp → null.
 */
export function waNumber(link: string | null | undefined): string | null {
  const m = link?.match(/\/chats\/waw(\d+)/);
  return m ? `WA-${m[1].slice(-2)}` : null;
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
