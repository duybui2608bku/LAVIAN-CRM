import { z } from "zod";

export const SESSION_DETAILS = ["laser", "plasma", "retouch"] as const;
export const SINGLE_DETAILS = ["new", "debt"] as const;
export type ServiceDetail = (typeof SESSION_DETAILS)[number] | (typeof SINGLE_DETAILS)[number];
export const MAX_SESSION = 10;

export const appointmentPatchSchema = z.object({
  scheduled_at: z.iso.datetime({ offset: true }),
  checked_in: z.boolean(),
  service_ids: z.array(z.uuid()).max(100).transform((ids) => [...new Set(ids)]),
  payment_method: z.enum(["cash", "bank", "card"]).nullable(),
  staff_id: z.uuid().nullable(),
  technician_id: z.uuid().nullable(),
  service_detail: z.enum([...SESSION_DETAILS, ...SINGLE_DETAILS]).nullable(),
  service_session: z.number().int().min(1).max(MAX_SESSION).nullable(),
  bill_amount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  note: z.string().trim().max(10000),
}).partial().strict()
  .refine((patch) => Object.keys(patch).length > 0)
  // Dịch vụ chi tiết luôn gửi kèm số lần (khớp check constraint DB).
  .refine((p) => (p.service_detail === undefined) === (p.service_session === undefined))
  .refine((p) => p.service_detail === undefined || p.service_detail === null
    ? !p.service_session
    : (SESSION_DETAILS as readonly string[]).includes(p.service_detail) === (p.service_session != null));

/** % tour cho kỹ thuật viên: Laser/Plasma 0, New/Debt 7%, Retouch lần 1 3%, lần ≥2 0. */
export function tourRate(detail: ServiceDetail, session: number | null): number {
  if (detail === "new" || detail === "debt") return 0.07;
  if (detail === "retouch") return session === 1 ? 0.03 : 0;
  return 0;
}

export function tourAmount(detail: ServiceDetail | null, session: number | null, bill: number | null) {
  return detail && bill != null ? Math.round(bill * tourRate(detail, session)) : null;
}

/** Mã hóa cho select gộp: "retouch:2" | "new". */
export const encodeDetail = (detail: ServiceDetail | null, session: number | null) =>
  detail ? (session ? `${detail}:${session}` : detail) : "";

export function decodeDetail(value: string) {
  if (!value) return { service_detail: null, service_session: null };
  const [detail, session] = value.split(":");
  return { service_detail: detail as ServiceDetail, service_session: session ? Number(session) : null };
}
