import { cn } from "@/lib/utils";

/**
 * Một mục có tiêu đề — dùng chung cho khối báo cáo (truyền `className="surface p-4"`)
 * lẫn nhóm field trong drawer / modal. Tiêu đề không đánh số, không dòng mô tả.
 */
export function Section({
  title,
  icon: Icon,
  extra,
  className,
  children,
}: {
  title: React.ReactNode;
  /** Icon nhỏ trước tiêu đề (khối báo cáo). */
  icon?: React.ElementType;
  /** Góc phải tiêu đề: nút, bộ lọc nhỏ, số tổng. */
  extra?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex min-h-6 items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          {Icon ? <Icon className="size-4 shrink-0 text-primary" /> : null}
          {title}
        </h3>
        {extra}
      </div>
      {children}
    </section>
  );
}
