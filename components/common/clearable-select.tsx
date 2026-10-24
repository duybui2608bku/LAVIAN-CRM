"use client";

import { Select } from "antd";

// label là ReactNode để option có thể kèm avatar/icon.
export type SelectOption = { value: string; label: React.ReactNode };

/**
 * Select antd quy ước chuỗi rỗng = chưa chọn (khớp cột nullable lưu "" ở form).
 * Bấm X (allowClear) gọi onChange(""). Dùng được trực tiếp trong Form.Item.
 */
export function ClearableSelect({
  value,
  onChange,
  options,
  placeholder,
  clearable = true,
  ariaLabel,
  className,
  disabled,
  size,
  variant,
  searchable,
}: {
  value?: string | null;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  clearable?: boolean;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  size?: "small" | "middle";
  variant?: "outlined" | "borderless" | "filled";
  /** Gõ để lọc — chỉ dùng khi label là chuỗi. */
  searchable?: boolean;
}) {
  return (
    <Select
      value={value || undefined}
      onChange={(v) => onChange?.(v ?? "")}
      options={options}
      placeholder={placeholder}
      allowClear={clearable}
      aria-label={ariaLabel}
      className={className}
      disabled={disabled}
      size={size}
      variant={variant}
      popupMatchSelectWidth={false}
      showSearch={searchable ? { optionFilterProp: "label" } : undefined}
    />
  );
}
