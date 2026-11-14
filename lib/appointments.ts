import { z } from "zod";

import type { BookingStatus } from "@/types/appointment";

// Literal (không import giá trị từ types/ — node --test không hiểu alias "@/"); test đối chiếu BOOKING_STATUSES.
export const BOOKING_STATUS_VALUES = ["pending", "confirmed", "cancelled", "rescheduled"] as const satisfies readonly BookingStatus[];

export const appointmentPatchSchema = z.object({
  scheduled_at: z.iso.datetime({ offset: true }),
  booking_confirm: z.enum(BOOKING_STATUS_VALUES),
  checked_in: z.boolean(),
  service_ids: z.array(z.uuid()).max(100).transform((ids) => [...new Set(ids)]),
  staff_id: z.uuid().nullable(),
  note: z.string().trim().max(10000),
}).partial().strict()
  .refine((patch) => Object.keys(patch).length > 0);
