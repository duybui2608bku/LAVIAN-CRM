"use client";

import type { ReactNode } from "react";
import { Button, Dropdown } from "antd";
import { MoreHorizontal } from "lucide-react";

export type RowAction = {
  icon: ReactNode;
  label: string;
  /** Số lượng liên quan — chỉ để hiển thị; khoá mục bằng `disabled`. */
  count?: number;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
};

/**
 * Menu "3 chấm" gom thao tác phụ của 1 dòng bảng — dùng chung cho mọi bảng
 * để thao tác trên dòng ở đâu cũng nằm cùng một chỗ.
 */
export function RowActions({
  label,
  items,
}: {
  label: string;
  items: RowAction[];
}) {
  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      menu={{
        items: items.map((item) => ({
          key: item.label,
          icon: item.icon,
          danger: item.danger,
          disabled: item.disabled,
          label: (
            <span className="flex min-w-36 items-center justify-between gap-3">
              {item.label}
              {item.count ? (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {item.count}
                </span>
              ) : null}
            </span>
          ),
        })),
        onClick: ({ key }) => items.find((i) => i.label === key)?.onSelect(),
      }}
    >
      <Button
        type="text"
        size="small"
        title={label}
        aria-label={label}
        icon={<MoreHorizontal className="size-4" />}
      />
    </Dropdown>
  );
}
