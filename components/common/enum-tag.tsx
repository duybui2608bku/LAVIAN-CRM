import type { CSSProperties } from "react";
import { Tag } from "antd";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";

import { cn } from "@/lib/utils";

/**
 * Tag cho một giá trị danh mục: nhãn + icon + màu do admin cấu hình ở /enums.
 * Màu qua CSS var `--tag` + color-mix (class `.tag-tint` ở globals.css):
 * light = chữ màu gốc / nền 10%; dark = chữ pha sáng để không chìm.
 * Không màu: Tag mặc định của antd.
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
    <Tag
      icon={icon ? <DynamicIcon name={icon as IconName} className="size-3.5" aria-hidden /> : undefined}
      className={cn("tag-inline me-0 max-w-full", color && "tag-tint", className)}
      style={color ? ({ "--tag": color } as CSSProperties) : undefined}
    >
      <span className="truncate">{label}</span>
    </Tag>
  );
}
