"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Button, Input, Popover } from "antd";
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";
import { ChevronsUpDown, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

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
  onChange?: (icon: string | null) => void;
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
    onChange?.(name);
    setOpen(false);
  };

  const panel = (
    <div className="w-72">
      <div className="flex items-center gap-1.5">
        <Input
          autoFocus
          allowClear
          prefix={<Search className="size-4 text-muted-foreground" />}
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {value ? (
          <Button
            type="text"
            title={clearLabel}
            aria-label={clearLabel}
            icon={<X className="size-4" />}
            onClick={() => pick(null)}
          />
        ) : null}
      </div>

      <div className="mt-2 grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
        {shown.map((name) => (
          <Button
            key={name}
            type={value === name ? "primary" : "text"}
            ghost={value === name}
            title={name}
            aria-label={name}
            icon={<DynamicIcon name={name as IconName} className="size-4" />}
            onClick={() => pick(name)}
          />
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
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomLeft"
      content={panel}
    >
      <Button
        disabled={disabled}
        className={cn("w-full justify-start", !value && "text-muted-foreground", className)}
        icon={
          value ? (
            <DynamicIcon name={value as IconName} className="size-4" />
          ) : (
            <Search className="size-4" />
          )
        }
      >
        <span className="flex-1 truncate text-left">{value || placeholder}</span>
        <ChevronsUpDown className="size-3.5 opacity-50" />
      </Button>
    </Popover>
  );
}
