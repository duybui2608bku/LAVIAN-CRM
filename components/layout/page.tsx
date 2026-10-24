import { cn } from "@/lib/utils";

/**
 * Shell chung cho mọi trang trong `app/(app)`.
 * Một chỗ duy nhất quy định padding + nhịp dọc của trang — trang con KHÔNG tự
 * đặt lại `p-*`/`gap-*` để tránh trôi mỗi nơi một kiểu.
 */
export function Page({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-1 flex-col gap-4 p-4 sm:p-6", className)}>
      {children}
    </div>
  );
}

/** Tiêu đề trang + mô tả + nút thao tác. Trang con không tự viết `<h1>`. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {/* Thẻ thuần (không Typography.Title): file này render cả ở Server
            Component, nơi không "chấm" vào export client của antd được. */}
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Hàng bộ lọc — control antd mặc định cao 32px, tự đều nhau. */
export function PageToolbar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  );
}
