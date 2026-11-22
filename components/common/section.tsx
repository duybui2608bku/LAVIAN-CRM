import { cn } from "@/lib/utils";

/**
 * Một mục có tiêu đề — dùng chung cho khối báo cáo (truyền `className="surface p-4"`)
 * lẫn nhóm field trong drawer / modal. Tiêu đề không đánh số, không dòng mô tả.
 */
export function Section({
  title,
  extra,
  className,
  children,
}: {
  title: React.ReactNode;
  /** Góc phải tiêu đề: nút, bộ lọc nhỏ, số tổng. */
  extra?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex min-h-6 items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}
