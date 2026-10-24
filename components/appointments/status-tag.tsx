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
  pending_confirmation: { icon: "clock", color: "#fa8c16" },
  booked: { icon: "calendar-check", color: "#1677ff" },
  checked_in: { icon: "log-in", color: "#722ed1" },
  completed: { icon: "check-check", color: "#52c41a" },
  no_show: { icon: "user-x", color: "#f5222d" },
  cancelled: { icon: "ban", color: "#8c8c8c" },
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
