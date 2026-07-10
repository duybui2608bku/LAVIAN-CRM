"use client";

import type { CSSProperties } from "react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Tag cho một giá trị danh mục: nhãn + icon + màu do admin cấu hình ở /enums.
 * Kích thước đồng bộ theo Badge. Màu qua CSS var `--tag` + color-mix:
 * light = chữ màu gốc / nền 10%; dark = chữ pha sáng 35% để không chìm.
 * Không màu: fallback Badge secondary như cũ.
 */
export function EnumTag({
  label,
  icon,
  color,
  className,
}: {
  label: string;
  icon?: string | null;
  color?: string | null;
  className?: string;
}) {
  return (
    <Badge
      variant={color ? "outline" : "secondary"}
      className={cn(
        "max-w-full",
        color &&
          "border-(--tag)/25 bg-(--tag)/10 text-(--tag) dark:border-(--tag)/40 dark:bg-(--tag)/20 dark:text-[color-mix(in_oklab,var(--tag)_65%,white)]",
        className,
      )}
      style={color ? ({ "--tag": color } as CSSProperties) : undefined}
    >
      {icon ? <DynamicIcon name={icon as IconName} aria-hidden /> : null}
      <span className="truncate">{label}</span>
    </Badge>
  );
}
