import { Page } from "@/components/layout/page";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Khung xương cho mọi trang trong shell — hiện NGAY khi bấm điều hướng, thay vì
 * đứng hình chờ query server xong. Dựng bằng chính `<Page>` nên khung không bị
 * nhảy khi dữ liệu thật đổ vào.
 * ponytail: một khung dùng chung; tách riêng theo route nếu bố cục lệch hẳn.
 */
export default function Loading() {
  return (
    <Page>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Skeleton className="h-7 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[220, 140, 140, 140, 240].map((w) => (
          <Skeleton key={w} className="h-8" style={{ width: w }} />
        ))}
      </div>

      <div className="surface overflow-hidden">
        <div className="h-11 border-b bg-muted/70" />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-3 py-2.5 last:border-0">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </Page>
  );
}
