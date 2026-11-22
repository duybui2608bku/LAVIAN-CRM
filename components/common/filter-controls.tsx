"use client";

import { Button, Input } from "antd";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

/** Ô tìm kiếm của thanh lọc — 1 kiểu cho mọi trang. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      allowClear
      className={className ?? "w-full sm:max-w-64"}
      prefix={<Search className="size-4 text-muted-foreground" />}
      placeholder={placeholder}
      aria-label={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Nút "Xoá bộ lọc" — chỉ hiện khi đang có lọc (`show`). */
export function ClearFilters({ show, onClick }: { show: boolean; onClick: () => void }) {
  const t = useTranslations("common");
  if (!show) return null;
  return (
    <Button type="text" icon={<X className="size-4" />} onClick={onClick}>
      {t("clearFilters")}
    </Button>
  );
}
