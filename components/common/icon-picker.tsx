"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";
import { ChevronsUpDown, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ponytail: chỉ render tối đa 96 kết quả — mount cả ~1600 DynamicIcon (mỗi cái 1
// lazy chunk) sẽ ì; gõ thêm ký tự để thu hẹp, có bộ đếm x/y báo còn bao nhiêu.
const MAX_SHOWN = 96;

/**
 * Picker tìm kiếm icon Lucide (toàn bộ bộ icon, lazy-load từng icon).
 * `value` là tên icon kebab-case (vd. "phone-call"), rỗng/null = chưa chọn.
 * Text hiển thị truyền qua props để nơi dùng tự i18n (component tự chứa).
 */
export function IconPicker({
  value,
  onChange,
  placeholder = "Chọn icon",
  searchPlaceholder = "Tìm icon…",
  clearLabel = "Bỏ icon",
  emptyText = "Không thấy icon phù hợp",
  countText = (shown, total) => `${shown}/${total}`,
  disabled,
  className,
}: {
  value?: string | null;
  onChange: (icon: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  clearLabel?: string;
  emptyText?: string;
  countText?: (shown: number, total: number) => string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Giữ ô gõ mượt khi grid icon re-render theo từ khóa.
  const q = useDeferredValue(query);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle
      ? iconNames.filter((n) => n.includes(needle))
      : (iconNames as readonly string[]);
  }, [q]);
  const shown = matches.slice(0, MAX_SHOWN);

  const pick = (name: string | null) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-8 w-full justify-start gap-2 px-2.5 font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          {value ? (
            <DynamicIcon name={value as IconName} className="size-4" />
          ) : (
            <Search className="size-4" />
          )}
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-auto size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            className="h-8"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {value ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              title={clearLabel}
              aria-label={clearLabel}
              onClick={() => pick(null)}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>

        <div className="mt-2 grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
          {shown.map((name) => (
            <button
              key={name}
              type="button"
              title={name}
              aria-label={name}
              onClick={() => pick(name)}
              className={cn(
                "flex size-8 cursor-pointer items-center justify-center rounded-md border border-transparent text-foreground/80 outline-none hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
                value === name && "border-primary bg-primary/10 text-primary",
              )}
            >
              <DynamicIcon name={name as IconName} className="size-4" />
            </button>
          ))}
          {shown.length === 0 && (
            <p className="col-span-8 py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </p>
          )}
        </div>

        <p className="mt-1.5 text-right text-xs text-muted-foreground">
          {countText(shown.length, matches.length)}
        </p>
      </PopoverContent>
    </Popover>
  );
}
