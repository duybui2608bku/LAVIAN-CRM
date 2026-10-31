import { Tag } from "antd";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";

import { cn } from "@/lib/utils";

/** Tag danh mục với nền nhạt và viền theo màu preset của antd. */
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
      key={`${label}-${color}`}
      icon={icon ? <DynamicIcon name={icon as IconName} className="size-3.5" aria-hidden /> : undefined}
      color={color || undefined}
      variant="outlined"
      className={cn("tag-inline tag-motion me-0 max-w-full", className)}
    >
      <span className="truncate">{label}</span>
    </Tag>
  );
}
