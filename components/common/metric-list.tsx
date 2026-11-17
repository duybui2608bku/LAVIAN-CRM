"use client";

import { Empty } from "antd";

import { cn } from "@/lib/utils";

export type Metric = {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Chữ phụ nhỏ cạnh giá trị (vd %). */
  sub?: React.ReactNode;
};

export type MetricRow = {
  key: string;
  title: React.ReactNode;
  /** Góc phải dòng tiêu đề: số chính / trạng thái. */
  aside?: React.ReactNode;
  metrics: Metric[];
  /** Dưới lưới số: thanh phân bổ, tiến độ KPI… */
  footer?: React.ReactNode;
  onClick?: () => void;
  /** Dòng tổng: nền nhạt, chữ đậm. */
  strong?: boolean;
};

/**
 * Bản điện thoại cho bảng báo cáo: mỗi dòng 1 khối "tiêu đề + lưới số 3 cột",
 * ngăn bằng đường kẻ (không lồng thẻ trong thẻ). Đặt trong `.surface` hoặc Section.
 */
export function MetricList({
  rows,
  loading,
  empty,
  className,
}: {
  rows: MetricRow[];
  loading?: boolean;
  empty?: React.ReactNode;
  className?: string;
}) {
  if (loading && !rows.length)
    return (
      <div className={cn("flex flex-col gap-4 py-2", className)}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <span className="h-4 w-32 animate-pulse rounded bg-muted" />
            <span className="h-9 w-full animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  if (!rows.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={empty} className={className} />;

  return (
    <ul className={cn("flex flex-col divide-y divide-border", loading && "opacity-60", className)}>
      {rows.map((r) => (
        <li
          key={r.key}
          onClick={r.onClick}
          className={cn(
            "flex flex-col gap-2.5 px-4 py-3",
            r.strong && "bg-muted/40",
            r.onClick && "cursor-pointer transition-colors active:bg-muted",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className={cn("flex min-w-0 items-center gap-2", r.strong ? "font-semibold" : "font-medium")}>{r.title}</div>
            {r.aside != null ? <div className="shrink-0 text-right tabular-nums">{r.aside}</div> : null}
          </div>
          <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
            {r.metrics.map((m, i) => (
              <div key={i} className="min-w-0">
                <dt className="truncate text-xs text-muted-foreground">{m.label}</dt>
                <dd className={cn("truncate tabular-nums", r.strong ? "font-semibold" : "font-medium")}>
                  {m.value}
                  {m.sub != null ? <span className="ml-1 text-xs font-normal text-muted-foreground">{m.sub}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
          {r.footer}
        </li>
      ))}
    </ul>
  );
}
