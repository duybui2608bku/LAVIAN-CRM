"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SelectOption } from "@/components/common/clearable-select";

/**
 * Select nhiều giá trị: trigger (style như SelectTrigger) + Popover danh sách
 * toggle, check ở mục đã chọn. Controlled: onValueChange bắn mỗi lần toggle.
 * Trigger mặc định hiện badge các mục đã chọn / placeholder; truyền children
 * để thay nội dung trigger (vd. hiển thị badge tùy biến trên bảng).
 */
export function MultiSelect({
  value,
  onValueChange,
  onOpenChange,
  options,
  placeholder,
  ariaLabel,
  disabled,
  className,
  children,
}: {
  value: string[];
  onValueChange: (next: string[]) => void;
  onOpenChange?: (open: boolean) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const toggle = (v: string) =>
    onValueChange(
      value.includes(v) ? value.filter((x) => x !== v) : [...value, v],
    );
  const selected = options.filter((o) => value.includes(o.value));

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "flex min-h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-card py-1 pr-2 pl-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/25 dark:hover:bg-input/40 [&_svg:not([class*='size-'])]:size-4",
            className,
          )}
        >
          {children ??
            (selected.length ? (
              <span className="flex flex-wrap gap-1">
                {selected.map((o) => (
                  <Badge key={o.value} variant="secondary">
                    {o.label}
                  </Badge>
                ))}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            ))}
          <ChevronDown className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-64 w-56 overflow-y-auto p-1">
        {options.map((o) => {
          const isOn = value.includes(o.value);
          return (
            <button
              type="button"
              key={o.value}
              aria-pressed={isOn}
              onClick={() => toggle(o.value)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            >
              <Check className={cn("size-4", !isOn && "invisible")} />
              {o.label}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
