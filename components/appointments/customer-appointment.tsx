"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createAppointment, patchAppointment } from "@/app/(app)/appointments/actions";
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
  return <div className="flex flex-col items-start gap-1">
    <AppointmentDate value={appointment?.scheduled_at} disabled={pending || disabled}
      onSave={(iso) => start(async () => {
        try {
          const result = appointment
            ? await patchAppointment(appointment.id, { scheduled_at: iso })
            : await createAppointment(customerId, iso);
          if (result.error) toast.error(result.error);
          else toast.success(t("saved"));
        } catch { toast.error(t("saveError")); }
      })}
    />
    <Link className="text-xs" href={`/appointments?customer=${customerId}`}>{t("viewAppointments")}</Link>
  </div>;
}
