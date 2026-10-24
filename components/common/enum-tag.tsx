import { Tag } from "antd";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";

import { cn } from "@/lib/utils";

/**
 * Tag cho một giá trị danh mục: nhãn + icon + màu do admin cấu hình ở /enums.
 * Có màu: kiểu solid của antd (nền đặc = màu, chữ trắng) như Presets (solid).
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
      color={color || undefined}
      variant={color ? "solid" : undefined}
      className={cn("tag-inline me-0 max-w-full", className)}
    >
      <span className="truncate">{label}</span>
    </Tag>
  );
}
