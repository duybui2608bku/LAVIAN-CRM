import { cn } from "@/lib/utils";

/**
 * Ô bảng gộp Tên + SĐT: tên 1 dòng (đậm), SĐT chữ nhỏ màu phụ ngay dưới.
 * Line-height chặt để hàng không cao thêm nhiều; tên dài cắt "…" (hover xem đủ).
 * `name` có thể là link (vd. mở hội thoại SMAX) — truyền kèm `title` để hover vẫn ra tên.
 */
export function NamePhone({
  name,
  phone,
  title,
  className,
}: {
  name: React.ReactNode;
  phone?: string | null;
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 leading-tight", className)}>
      <div className="truncate font-medium" title={title ?? (typeof name === "string" ? name : undefined)}>
        {name}
      </div>
      {phone ? <div className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">{phone}</div> : null}
    </div>
  );
}
