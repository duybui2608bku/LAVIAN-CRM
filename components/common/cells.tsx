import { Badge } from "antd";
import dayjs from "dayjs";

import { cn } from "@/lib/utils";

/** Ô trống dùng chung cho mọi bảng / drawer. */
export const DASH = <span className="text-muted-foreground">—</span>;

/**
 * Kiểu hiển thị trạng thái DUY NHẤT của app: chấm màu + chữ (checklist.design — Badge:
 * màu chỉ cho trạng thái chuẩn, luôn kèm chữ). `color` = preset antd (blue, green…) hoặc hex;
 * "default"/trống = chấm xám. Ngày, số, mã, tên, SĐT… KHÔNG dùng component này — chữ thường.
 */
export function StatusDot({ color, label, className }: { color?: string | null; label: React.ReactNode; className?: string }) {
  return !color || color === "default"
    ? <Badge status="default" text={label} className={cn("whitespace-nowrap", className)} />
    : <Badge color={color} text={label} className={cn("whitespace-nowrap", className)} />;
}

/** Ô ngày giờ 2 dòng: ngày trên, giờ nhỏ màu phụ dưới. `className` vd. "text-destructive" khi quá hạn. */
export function DateTimeCell({ value, className }: { value?: string | null; className?: string }) {
  if (!value) return DASH;
  const d = dayjs(value);
  return (
    <div className={cn("leading-tight tabular-nums", className)}>
      <div>{d.format("DD/MM/YYYY")}</div>
      <div className="text-xs text-muted-foreground">{d.format("HH:mm")}</div>
    </div>
  );
}
