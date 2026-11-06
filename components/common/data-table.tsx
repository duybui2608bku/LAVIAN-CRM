"use client";

import { Table, type TableProps } from "antd";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * Bảng dữ liệu dùng chung cho mọi trang — một kiểu size, viền, cuộn ngang và
 * phân trang. Trang chỉ truyền `columns`, `dataSource`, `pageSize` (0 = không
 * phân trang) và `empty`.
 */
export function DataTable<T extends object>({
  pageSize = 20,
  page,
  onPageChange,
  empty,
  className,
  scroll,
  ...props
}: Omit<TableProps<T>, "pagination" | "size" | "bordered" | "locale"> & {
  pageSize?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  empty?: React.ReactNode;
}) {
  const t = useTranslations("common");
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
