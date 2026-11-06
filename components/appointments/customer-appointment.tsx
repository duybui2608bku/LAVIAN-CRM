"use client";

import { useTransition } from "react";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";
import { createAppointment } from "@/app/(app)/appointments/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { toast } from "@/lib/toast";
import type { AppointmentSummary } from "@/types/appointment";

export function CustomerAppointment({ customerId, appointment, disabled }: {
  customerId: string;
  appointment?: AppointmentSummary;
  disabled?: boolean;
}) {
  const t = useTranslations("appointments");
  const [pending, start] = useTransition();
  if (appointment) return <time dateTime={appointment.scheduled_at} className="whitespace-nowrap">
    {dayjs(appointment.scheduled_at).format("DD/MM/YYYY HH:mm")}
  </time>;

  return <AppointmentDate disabled={pending || disabled}
      onSave={(iso) => start(async () => {
        try {
          const result = await createAppointment(customerId, iso);
          if (result.error) toast.error(result.error);
          else toast.success(t("saved"));
        } catch { toast.error(t("saveError")); }
      })}
    />;
}
