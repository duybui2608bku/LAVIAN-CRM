"use client";

import { DatePicker } from "antd";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";

/** Confirm date and time together; changing the day alone never writes a booking. */
export function AppointmentDate({ value, disabled, onSave }: {
  value?: string | null;
  disabled?: boolean;
  onSave: (iso: string) => void;
}) {
  const t = useTranslations("appointments");
  return <DatePicker
    value={value ? dayjs(value) : null}
    showTime={{ format: "HH:mm" }}
    format="DD/MM/YYYY HH:mm"
    needConfirm
    allowClear={false}
    disabled={disabled}
    aria-label={t("date")}
    placeholder={t("chooseDate")}
    className="w-48"
    onChange={(date) => {
      const iso = date?.second(0).millisecond(0).toISOString();
      if (iso && iso !== value) onSave(iso);
    }}
  />;
}
