import { PageTransition } from "@/components/layout/page-transition";
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
    <PageTransition className={cn("flex w-full flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-5", className)}>
      {children}
    </PageTransition>
  );
}

/** Tiêu đề trang + nút thao tác (nằm bên trái, ngay sau tiêu đề). Trang con không tự viết `<h1>`. */
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0">
        {/* Thẻ thuần (không Typography.Title): file này render cả ở Server
            Component, nơi không "chấm" vào export client của antd được. */}
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:[&>*]:flex-1">
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
    // Điện thoại: mỗi control 1 hàng, full width (không ô dài ô ngắn).
    <div className={cn("flex flex-wrap items-center gap-2 max-sm:flex-col max-sm:items-stretch max-sm:[&>*]:w-full! max-sm:[&>*]:max-w-none!", className)}>
      {children}
    </div>
  );
}
