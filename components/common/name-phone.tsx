import { cn } from "@/lib/utils";

/**
 * Ô bảng gộp Tên + SĐT: tên 1 dòng (đậm), SĐT chữ nhỏ màu phụ ngay dưới.
 * Line-height chặt để hàng không cao thêm nhiều; tên dài cắt "…" (hover xem đủ).
 * `name` có thể là link (vd. mở hội thoại SMAX) — truyền kèm `title` để hover vẫn ra tên.
 * `extra`: nối sau SĐT trên dòng phụ (vd. " · Sulam Alis" ở bảng Lịch hẹn).
 */
export function NamePhone({
  name,
  phone,
  title,
  extra,
  className,
}: {
  name: React.ReactNode;
  phone?: string | null;
  title?: string;
  extra?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 leading-tight", className)}>
      <div className="truncate font-medium" title={title ?? (typeof name === "string" ? name : undefined)}>
        {name}
      </div>
      {phone || extra ? (
        <div className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">
          {phone}
          {extra}
        </div>
      ) : null}
    </div>
  );
}
