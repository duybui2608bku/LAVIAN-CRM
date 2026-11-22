import { Tag } from "antd";
import dayjs from "dayjs";

import { cn } from "@/lib/utils";

/** Ô trống dùng chung cho mọi bảng / drawer. */
export const DASH = <span className="text-muted-foreground">—</span>;

/**
 * Kiểu hiển thị trạng thái DUY NHẤT của app: tag màu + chữ (Status khách, Status lịch hẹn,
 * Xác nhận đặt lịch, trạng thái thẻ / tour / chiến dịch…). `color` = preset antd (blue, green…)
 * hoặc hex; "default"/trống = tag xám. Ngày, số, mã, tên, SĐT… KHÔNG dùng tag — chữ thường.
 */
export function StatusTag({ color, label, className }: { color?: string | null; label: React.ReactNode; className?: string }) {
  return (
    <Tag color={color && color !== "default" ? color : undefined} variant="outlined" className={cn("me-0 whitespace-nowrap", className)}>
      {label}
    </Tag>
  );
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
