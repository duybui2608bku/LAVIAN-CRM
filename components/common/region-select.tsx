"use client";

import { Select } from "antd";
import { PROVINCES, citiesOf } from "@/lib/id-regions";

/**
 * Chọn khu vực Indonesia 2 cấp, dùng trực tiếp trong Form.Item.
 * value = mã tỉnh ("31") hoặc mã huyện/TP ("31.71"); "" = chưa chọn.
 * Đổi tỉnh → xoá huyện; xoá huyện → còn mã tỉnh.
 */
export function RegionSelect({
  value,
  onChange,
  provinceLabel,
  cityLabel,
}: {
  value?: string | null;
  onChange?: (value: string) => void;
  provinceLabel: string;
  cityLabel: string;
}) {
  const province = value ? value.slice(0, 2) : undefined;
  const city = value && value.length > 2 ? value : undefined;
  const search = { optionFilterProp: "label" } as const;

  return (
    <div className="grid grid-cols-2 gap-2">
      <Select
        value={province}
        onChange={(v) => onChange?.(v ?? "")}
        options={PROVINCES}
        placeholder={provinceLabel}
        aria-label={provinceLabel}
        allowClear
        showSearch={search}
      />
      <Select
        value={city}
        onChange={(v) => onChange?.(v ?? province ?? "")}
        options={province ? citiesOf(province) : []}
        placeholder={cityLabel}
        aria-label={cityLabel}
        disabled={!province}
        allowClear
        showSearch={search}
      />
    </div>
  );
}
