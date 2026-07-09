"use client";

import { DynamicIcon, type IconName } from "lucide-react/dynamic";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Tag cho một giá trị danh mục: nhãn + icon + màu do admin cấu hình ở /enums.
 * Có màu: chữ/icon = màu gốc, nền ~10% alpha, viền ~25% alpha (hex + suffix)
 * — đọc được cả sáng lẫn tối. Không màu: fallback Badge secondary như cũ.
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
      className={cn("max-w-full", className)}
      style={
        color
          ? {
              color,
              backgroundColor: `${color}1a`,
              borderColor: `${color}40`,
            }
          : undefined
      }
    >
      {icon ? <DynamicIcon name={icon as IconName} aria-hidden /> : null}
      <span className="truncate">{label}</span>
    </Badge>
  );
}
