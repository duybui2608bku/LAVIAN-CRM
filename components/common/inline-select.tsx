"use client";

import { useState } from "react";
import { Checkbox, Popover, Select } from "antd";

import type { SelectOption } from "@/components/common/clearable-select";

const NONE = "__none";

/**
 * Select sửa inline trong ô bảng: không viền, phần hiển thị là chính giá trị
 * (tag/avatar…) qua `display`. `noneLabel` có = cho phép bỏ chọn ("" = trống).
 * Chỉ gọi onSave khi giá trị thật sự đổi.
 */
export function InlineSelect({
  value,
  display,
  options,
  noneLabel,
  ariaLabel,
  disabled,
  onSave,
}: {
  value: string;
  display: React.ReactNode;
  options: SelectOption[];
  noneLabel?: string;
  ariaLabel: string;
  disabled?: boolean;
  onSave: (value: string) => void;
}) {
  return (
    <Select
      variant="borderless"
      size="small"
      value={value || NONE}
      labelRender={() => display}
      aria-label={ariaLabel}
      disabled={disabled}
      popupMatchSelectWidth={false}
      className="-mx-2 max-w-full"
      options={
        noneLabel
          ? [{ value: NONE, label: <span className="text-muted-foreground">{noneLabel}</span> }, ...options]
          : options
      }
      onChange={(v: string) => {
        const next = v === NONE ? "" : v;
        if (next !== value) onSave(next);
      }}
    />
  );
}

/**
 * Chọn nhiều inline trong ô bảng: bấm vào phần hiển thị mở danh sách checkbox,
 * gom thay đổi và chỉ lưu 1 lần khi đóng (nếu tập giá trị đổi).
 */
export function InlineMultiSelect({
  value,
  display,
  options,
  ariaLabel,
  disabled,
  onSave,
}: {
  value: string[];
  display: React.ReactNode;
  options: SelectOption[];
  ariaLabel: string;
  disabled?: boolean;
  onSave: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[] | null>(null); // null = đang đóng

  const onOpenChange = (open: boolean) => {
    if (open) {
      setDraft(value);
      return;
    }
    // So như tập hợp (thứ tự chọn có thể khác) — chỉ lưu khi thật sự đổi.
    if (draft && (draft.length !== value.length || draft.some((d) => !value.includes(d))))
      onSave(draft);
    setDraft(null);
  };

  return (
    <Popover
      trigger="click"
      placement="bottomLeft"
      open={!disabled && draft !== null}
      onOpenChange={onOpenChange}
      content={
        <Checkbox.Group
          className="flex max-h-64 flex-col gap-1.5 overflow-y-auto"
          value={draft ?? value}
          onChange={(v) => setDraft(v as string[])}
          options={options}
        />
      }
    >
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        className="-mx-1 rounded px-1 py-0.5 text-left hover:bg-muted"
      >
        {display}
      </button>
    </Popover>
  );
}
