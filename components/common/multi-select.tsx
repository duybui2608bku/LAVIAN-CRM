"use client";

import { Select } from "antd";

import type { SelectOption } from "@/components/common/clearable-select";

/**
 * Select nhiều giá trị (antd `mode="multiple"`). Controlled: onChange bắn mỗi
 * lần toggle; onOpenChange để nơi dùng chốt lưu một lần khi đóng popup.
 */
export function MultiSelect({
  value,
  onChange,
  onOpenChange,
  options,
  placeholder,
  ariaLabel,
  disabled,
  className,
  variant,
}: {
  value?: string[];
  onChange?: (next: string[]) => void;
  onOpenChange?: (open: boolean) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  variant?: "outlined" | "borderless" | "filled";
}) {
  return (
    <Select
      mode="multiple"
      value={value ?? []}
      onChange={onChange}
      onOpenChange={onOpenChange}
      options={options}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      className={className}
      variant={variant}
      maxTagCount="responsive"
      popupMatchSelectWidth={false}
    />
  );
}
