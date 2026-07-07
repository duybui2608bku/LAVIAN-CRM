"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption = { value: string; label: string };

/**
 * Select shadcn kèm nút xoá giá trị.
 * value="" = chưa chọn (hiện placeholder). Bấm X gọi onValueChange("").
 * Bề rộng theo ngữ cảnh cha (flex → fit nội dung, grid → giãn hết ô).
 */
export function ClearableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  clearable = true,
  clearLabel,
  ariaLabel,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  clearable?: boolean;
  clearLabel?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const showClear = clearable && !!value;

  return (
    <div className={cn("relative", className)}>
      <Select value={value} onValueChange={onValueChange}>
        {/* Ẩn chevron khi có nút X để hai icon không chồng nhau. */}
        <SelectTrigger
          aria-label={ariaLabel}
          className={cn("w-full", showClear && "[&>svg]:opacity-0")}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showClear && (
        <button
          type="button"
          title={clearLabel}
          aria-label={clearLabel}
          onClick={() => onValueChange("")}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
