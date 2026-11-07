"use client";

import { Fragment, useState } from "react";
import { Empty, Pagination, Table, type TableColumnType, type TableProps } from "antd";
import { useTranslations } from "next-intl";

import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

type Props<T> = Omit<TableProps<T>, "pagination" | "size" | "bordered" | "locale"> & {
  pageSize?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  empty?: React.ReactNode;
};

/**
 * Bảng dữ liệu dùng chung cho mọi trang — một kiểu size, viền, cuộn ngang và
 * phân trang. Trang chỉ truyền `columns`, `dataSource`, `pageSize` (0 = không
 * phân trang) và `empty`. Điện thoại (< sm): tự đổi sang danh sách thẻ.
 */
export function DataTable<T extends object>({
  pageSize = 20,
  page,
  onPageChange,
  empty,
  className,
  scroll,
  ...props
}: Props<T>) {
  const t = useTranslations("common");
  const mobile = useIsMobile();

  if (mobile) {
    return <CardList<T> {...props} pageSize={pageSize} page={page} onPageChange={onPageChange}
      empty={empty} className={className} />;
  }

  return (
    <div className={cn("surface overflow-hidden", className)}>
      <Table<T>
        rowKey="id"
        size="middle"
        scroll={{ x: "max-content", ...scroll }}
        locale={empty ? { emptyText: empty } : undefined}
        pagination={
          pageSize
            ? {
                current: page,
                onChange: onPageChange,
                pageSize,
                showSizeChanger: false,
                hideOnSinglePage: true,
                size: "small",
                showTotal: (total, [from, to]) => t("pageInfo", { from, to, total }),
              }
            : false
        }
        {...props}
      />
    </div>
  );
}

type Column<T> = TableColumnType<T>;

function cellValue<T>(col: Column<T>, record: T, index: number): React.ReactNode {
  const path = col.dataIndex == null ? [] : ([] as (string | number)[]).concat(col.dataIndex as string | number);
  const value = path.reduce<unknown>((v, k) => (v as Record<string | number, unknown> | undefined)?.[k], record);
  const out = col.render ? col.render(value, record, index) : value;
  // render kiểu cũ của antd có thể trả { children, props }.
  if (out && typeof out === "object" && "children" in out && "props" in out && !("$$typeof" in out)) {
    return (out as { children: React.ReactNode }).children;
  }
  return out as React.ReactNode;
}

/** Bản điện thoại của DataTable: mỗi dòng 1 thẻ "tên cột : giá trị", cột thao tác ở góc phải. */
function CardList<T extends object>({
  columns = [],
  dataSource = [],
  rowKey = "id",
  onRow,
  pageSize = 20,
  page,
  onPageChange,
  empty,
  className,
}: Props<T>) {
  const t = useTranslations("common");
  const [innerPage, setInnerPage] = useState(1);
  const cols = (columns as Column<T>[]).filter((c) => !c.hidden);
  // Cột thao tác (key "actions" hoặc không tiêu đề) lên góc phải thẻ.
  const isAction = (c: Column<T>) => c.key === "actions" || !c.title;
  const actions = cols.filter(isAction);
  const fields = cols.filter((c) => !isAction(c));
  const total = dataSource.length;
  const current = Math.min(page ?? innerPage, Math.max(1, Math.ceil(total / (pageSize || total || 1))));
  const from = pageSize ? (current - 1) * pageSize : 0;
  const rows = pageSize ? dataSource.slice(from, from + pageSize) : dataSource;
  const keyOf = (r: T, i: number) =>
    String(typeof rowKey === "function" ? rowKey(r, i) : (r as Record<string, unknown>)[rowKey as string]);

  if (!total) {
    return <div className={cn("surface py-10", className)}><Empty description={empty} /></div>;
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {rows.map((record, i) => {
        const index = from + i;
        const row = onRow?.(record, index) ?? {};
        return (
          <div
            key={keyOf(record, index)}
            onClick={row.onClick}
            className={cn(
              "surface relative flex flex-col p-3",
              row.onClick && "cursor-pointer transition-colors active:bg-muted",
            )}
          >
            {actions.length ? (
              <div className="absolute top-2 right-2 flex items-center gap-1">
                {actions.map((c, k) => <Fragment key={k}>{cellValue(c, record, index)}</Fragment>)}
              </div>
            ) : null}
            <dl className={cn("grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-sm", actions.length && "pr-9")}>
              {fields.map((c, k) => (
                <Fragment key={String(c.key ?? c.dataIndex ?? k)}>
                  <dt className="break-words text-xs text-muted-foreground">{c.title as React.ReactNode}</dt>
                  <dd className="min-w-0 break-words">{cellValue(c, record, index) ?? "—"}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        );
      })}
      {pageSize && total > pageSize ? (
        <div className="flex flex-col items-center gap-1 pt-1">
          <Pagination
            simple
            current={current}
            pageSize={pageSize}
            total={total}
            onChange={(p) => { setInnerPage(p); onPageChange?.(p); window.scrollTo({ top: 0 }); }}
          />
          <span className="text-xs text-muted-foreground">
            {t("pageInfo", { from: from + 1, to: Math.min(from + pageSize, total), total })}
          </span>
        </div>
      ) : null}
    </div>
  );
}
