import { cn } from "@/lib/utils";

export type IconTone = "primary" | "info" | "success" | "warning" | "destructive";
const ICON_TONE: Record<IconTone, string> = {
  primary: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

/** Card số liệu dùng chung: (ô icon +) nhãn → giá trị → gợi ý (tuỳ chọn). */
export function StatCard({
  label,
  value,
  hint,
  tone = "muted",
  icon: Icon,
  iconTone = "primary",
  loading,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ElementType;
  iconTone?: IconTone;
  /** Màu dòng gợi ý (không có gợi ý → màu số): `warning` / `destructive` khi cần cảnh báo. */
  tone?: "muted" | "warning" | "destructive";
  loading?: boolean;
}) {
  return (
    <div className={cn("surface flex min-w-0 flex-col p-3 sm:p-4", Icon ? "gap-2" : "gap-1")}>
      {Icon ? (
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", ICON_TONE[iconTone])}>
            <Icon className="size-4" />
          </span>
          <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
        </div>
      ) : (
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      )}
      {/* Không có dòng gợi ý → `tone` tô thẳng lên số (vd. số quá hạn màu đỏ). */}
      <div className={cn("truncate text-xl font-semibold sm:text-2xl tracking-tight tabular-nums",
        !hint && tone === "warning" && "text-warning", !hint && tone === "destructive" && "text-destructive")}>
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
