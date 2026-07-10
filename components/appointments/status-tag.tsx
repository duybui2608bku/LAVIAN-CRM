"use client";

import { useTranslations } from "next-intl";

import { EnumTag } from "@/components/common/enum-tag";
import type { AppointmentStatus } from "@/types/appointment";

// Màu/icon trạng thái hardcode (status do code điều khiển, không nằm trong
// enum_options) — render bằng EnumTag cho đồng bộ tag toàn app.
export const STATUS_META: Record<
  AppointmentStatus,
  { icon: string; color: string }
> = {
  pending_confirmation: { icon: "clock", color: "#f59e0b" },
  booked: { icon: "calendar-check", color: "#3b82f6" },
  checked_in: { icon: "log-in", color: "#8b5cf6" },
  completed: { icon: "check-check", color: "#22c55e" },
  no_show: { icon: "user-x", color: "#ef4444" },
  cancelled: { icon: "ban", color: "#6b7280" },
};

export function AppointmentStatusTag({
  status,
}: {
  status: AppointmentStatus;
}) {
  const t = useTranslations("appointments");
  return (
    <EnumTag
      icon={STATUS_META[status].icon}
      color={STATUS_META[status].color}
      label={t(`status_${status}`)}
    />
  );
}
