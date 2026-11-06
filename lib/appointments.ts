import { z } from "zod";

export const appointmentPatchSchema = z.object({
  scheduled_at: z.iso.datetime({ offset: true }),
  checked_in: z.boolean(),
  service_ids: z.array(z.uuid()).max(100).transform((ids) => [...new Set(ids)]),
  payment_method: z.enum(["cash", "bank", "card"]).nullable(),
  staff_id: z.uuid().nullable(),
  note: z.string().trim().max(10000),
}).partial().strict().refine((patch) => Object.keys(patch).length > 0);
