"use client";

import type { ReactNode } from "react";
import { Select } from "antd";
import { PROVINCES, citiesOf } from "@/lib/id-regions";

/**
 * Chọn khu vực Indonesia 2 cấp, dùng trực tiếp trong Form.Item.
 * value = mã tỉnh ("31") hoặc mã huyện/TP ("31.71"); "" = chưa chọn.
 * Đổi tỉnh → xoá huyện; xoá huyện → còn mã tỉnh.
 * `field`: bọc từng ô (vd. `Form.Item` có nhãn riêng) — mặc định 2 ô liền nhau, không nhãn.
 */
export function RegionSelect({
  value,
  onChange,
  provinceLabel,
  cityLabel,
  field = (_label, control) => control,
  className = "grid grid-cols-2 gap-2",
}: {
  value?: string | null;
  onChange?: (value: string) => void;
  provinceLabel: string;
  cityLabel: string;
  field?: (label: string, control: ReactNode) => ReactNode;
  className?: string;
}) {
  const province = value ? value.slice(0, 2) : undefined;
  const city = value && value.length > 2 ? value : undefined;
  const search = { optionFilterProp: "label" } as const;

  return (
    <div className={className}>
      {field(provinceLabel, <Select
        value={province}
        onChange={(v) => onChange?.(v ?? "")}
        options={PROVINCES}
        placeholder={provinceLabel}
        aria-label={provinceLabel}
        allowClear
        showSearch={search}
      />)}
      {field(cityLabel, <Select
        value={city}
        onChange={(v) => onChange?.(v ?? province ?? "")}
        options={province ? citiesOf(province) : []}
        placeholder={cityLabel}
        aria-label={cityLabel}
        disabled={!province}
        allowClear
        showSearch={search}
      />)}
    </div>
  );
}
