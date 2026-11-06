import { cn } from "@/lib/utils";

/** Card số liệu dùng chung: nhãn → giá trị → gợi ý (tuỳ chọn). */
export function StatCard({
  label,
  value,
  hint,
  tone = "muted",
  loading,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Màu dòng gợi ý: `warning` / `destructive` khi cần cảnh báo. */
  tone?: "muted" | "warning" | "destructive";
  loading?: boolean;
}) {
  return (
    <div className="surface flex min-w-0 flex-col gap-1 p-4">
      <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      <div className="truncate text-2xl font-semibold tracking-tight tabular-nums">
        {loading ? (
          <span className="inline-block h-7 w-24 animate-pulse rounded-md bg-muted" />
        ) : (
          value
        )}
      </div>
      {hint ? (
        <p
          className={cn(
            "text-xs",
            tone === "warning" && "text-warning",
            tone === "destructive" && "text-destructive",
            tone === "muted" && "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
