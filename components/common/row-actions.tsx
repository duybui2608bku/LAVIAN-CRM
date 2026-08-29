"use client";

import { useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type RowAction = {
  icon: ReactNode;
  label: string;
  /** Số lượng liên quan — chỉ để hiển thị; khoá mục bằng `disabled`. */
  count?: number;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
};

/**
 * Menu "3 chấm" gom thao tác phụ của 1 dòng bảng — dùng chung cho mọi bảng
 * để thao tác trên dòng ở đâu cũng nằm cùng một chỗ.
 */
export function RowActions({
  label,
  items,
}: {
  label: string;
  items: RowAction[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" title={label} aria-label={label}>
          <MoreHorizontal className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 gap-0.5 p-1">
        {items.map((item) => (
          <Button
            key={item.label}
            size="sm"
            variant="ghost"
            className={cn(
              "h-8 w-full justify-start gap-2 font-normal",
              item.danger && "text-destructive hover:text-destructive",
            )}
            disabled={item.disabled}
            onClick={() => {
              setOpen(false);
              item.onSelect();
            }}
          >
            {item.icon}
            <span className="flex-1 text-left">{item.label}</span>
            {item.count ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {item.count}
              </span>
            ) : null}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
