import { z } from "zod";
import type { AppointmentSummary } from "../types/appointment.ts";

export const appointmentPatchSchema = z.object({
  scheduled_at: z.iso.datetime({ offset: true }),
  checked_in: z.boolean(),
  service_ids: z.array(z.uuid()).max(100).transform((ids) => [...new Set(ids)]),
  payment_method: z.enum(["cash", "bank", "card"]).nullable(),
  staff_id: z.uuid().nullable(),
  note: z.string().trim().max(10000),
}).partial().strict().refine((patch) => Object.keys(patch).length > 0);

/** Past visits stay in history; the customer cell books a new visit instead of moving them. */
export function customerAppointment(rows: AppointmentSummary[], now: number): AppointmentSummary | undefined {
  const sorted = [...rows].sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  return sorted.find((a) => !a.checked_in && Date.parse(a.scheduled_at) >= now);
}
