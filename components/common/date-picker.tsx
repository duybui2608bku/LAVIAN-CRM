"use client";

import { DatePicker as AntDatePicker, TimePicker as AntTimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useTranslations } from "next-intl";

import { useIsTouch } from "@/hooks/use-is-mobile";
import { DATE_PRESETS, presetRange } from "@/lib/date-presets";

// Giá trị luôn là chuỗi `YYYY-MM-DD` ("" = trống) để khớp cột date + lib/date.
const FORMAT = "YYYY-MM-DD";
const DISPLAY = "DD/MM/YYYY";

const toDay = (s?: string | null) => (s ? dayjs(s, FORMAT) : null);
const toStr = (d?: Dayjs | null) => (d ? d.format(FORMAT) : "");

/** Date picker đơn. value/onChange dạng chuỗi `YYYY-MM-DD` ("" = trống). */
export function DatePicker({
  value,
  onChange,
  placeholder,
  className,
  id,
  allowClear = true,
}: {
  value?: string | null;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  allowClear?: boolean;
}) {
  // Cảm ứng: chọn bằng lịch, không bật bàn phím che mất lịch.
  const touch = useIsTouch();
  return (
    <AntDatePicker
      id={id}
      inputReadOnly={touch}
      value={toDay(value)}
      onChange={(d) => onChange?.(toStr(d))}
      placeholder={placeholder}
      format={DISPLAY}
      allowClear={allowClear}
      className={className ?? "w-full"}
    />
  );
}

/** Date range picker (kèm mốc nhanh Hôm nay / Tuần này / Tháng trước… trong popup).
 *  from/to dạng chuỗi `YYYY-MM-DD`, onChange trả cả cặp. */
export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder,
  className,
  allowClear = true,
}: {
  from?: string;
  to?: string;
  onChange: (range: { from: string; to: string }) => void;
  /** Một chuỗi cho cả 2 ô (giữ API cũ) hoặc cặp [từ, đến]. */
  placeholder?: string | [string, string];
  className?: string;
  allowClear?: boolean;
}) {
  const ph: [string, string] | undefined =
    typeof placeholder === "string" ? [placeholder, placeholder] : placeholder;
  const touch = useIsTouch();
  const t = useTranslations("common.datePreset");
  const today = dayjs().format(FORMAT);
  const presets = DATE_PRESETS.map((p) => {
    const r = presetRange(p, today);
    return { label: t(p), value: [toDay(r.from)!, toDay(r.to)!] as [Dayjs, Dayjs] };
  });
  return (
    <AntDatePicker.RangePicker
      inputReadOnly={touch}
      presets={presets}
      value={from ? [toDay(from), toDay(to)] : null}
      onChange={(r) => onChange({ from: toStr(r?.[0]), to: toStr(r?.[1]) })}
      placeholder={ph}
      format={DISPLAY}
      allowClear={allowClear}
      className={className}
    />
  );
}

/** Chọn giờ, value/onChange dạng chuỗi `HH:mm` ("" = trống). */
export function TimePicker({
  value,
  onChange,
  className,
}: {
  value?: string | null;
  onChange?: (value: string) => void;
  className?: string;
}) {
  const touch = useIsTouch();
  return (
    <AntTimePicker
      inputReadOnly={touch}
      value={value ? dayjs(value, "HH:mm") : null}
      onChange={(d) => onChange?.(d ? d.format("HH:mm") : "")}
      format="HH:mm"
      minuteStep={5}
      needConfirm={false}
      className={className ?? "w-full"}
    />
  );
}
