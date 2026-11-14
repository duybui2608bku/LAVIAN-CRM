"use client";

import { Segmented } from "antd";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";

import { DateRangePicker } from "@/components/common/date-picker";
import { DATE_PRESETS, matchPreset, presetRange, type DatePreset, type DateRange } from "@/lib/date-presets";

/** Ngày hôm nay `YYYY-MM-DD` theo giờ máy người dùng (VN/WIB cùng UTC+7). */
export const todayYmd = () => dayjs().format("YYYY-MM-DD");

/** Khoảng ngày của 1 mốc tính từ hôm nay — dùng làm state ban đầu. */
export const initialRange = (preset: DatePreset): DateRange => presetRange(preset, todayYmd());

/**
 * Bộ lọc ngày cho trang báo cáo: hàng mốc nhanh (Segmented) + ô chọn khoảng (Tùy chỉnh).
 * Khoảng không khớp mốc nào → hiện "Tùy chỉnh".
 */
export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  const t = useTranslations("common.datePreset");
  const today = todayYmd();
  const active = matchPreset(value, today);
  return (
    <>
      <div className="max-w-full overflow-x-auto">
        <Segmented<DatePreset | "custom">
          value={active ?? "custom"}
          onChange={(v) => v !== "custom" && onChange(presetRange(v, today))}
          options={[
            ...DATE_PRESETS.map((p) => ({ value: p, label: t(p) })),
            ...(active ? [] : [{ value: "custom" as const, label: t("custom") }]),
          ]}
        />
      </div>
      <DateRangePicker
        from={value.from}
        to={value.to}
        allowClear={false}
        onChange={(r) => r.from && onChange({ from: r.from, to: r.to || r.from })}
      />
    </>
  );
}
