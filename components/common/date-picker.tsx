"use client";

import * as React from "react";
import { CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { enUS, id as idLocale, vi } from "date-fns/locale";
import { useLocale } from "next-intl";

import { cn } from "@/lib/utils";
import { formatISODate, parseISODate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const DF_LOCALES = { vi, en: enUS, id: idLocale } as const;

function useDfLocale() {
  const locale = useLocale();
  return DF_LOCALES[locale as keyof typeof DF_LOCALES] ?? enUS;
}

/** Date picker đơn. value/onChange dạng chuỗi `YYYY-MM-DD` ("" = trống). */
export function DatePicker({
  value,
  onChange,
  placeholder,
  className,
  id,
}: {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const df = useDfLocale();
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const date = parseISODate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "h-8 w-full justify-start font-normal",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4" />
          {date ? date.toLocaleDateString(locale) : (placeholder ?? "")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          locale={df}
          autoFocus
          onSelect={(d) => {
            onChange(formatISODate(d));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Date range picker. from/to dạng chuỗi `YYYY-MM-DD`, onChange trả cả cặp. */
export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder,
  clearLabel,
  className,
}: {
  from?: string;
  to?: string;
  onChange: (range: { from: string; to: string }) => void;
  placeholder?: string;
  clearLabel?: string;
  className?: string;
}) {
  const df = useDfLocale();
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);

  const f = parseISODate(from);
  const tt = parseISODate(to);
  const range: DateRange | undefined = f ? { from: f, to: tt } : undefined;
  const hasValue = !!(from || to);

  const label =
    f && tt
      ? `${f.toLocaleDateString(locale)} – ${tt.toLocaleDateString(locale)}`
      : f
        ? f.toLocaleDateString(locale)
        : (placeholder ?? "");

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-8 w-full justify-start pr-8 font-normal",
              !hasValue && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={range}
            defaultMonth={f}
            locale={df}
            numberOfMonths={2}
            autoFocus
            onSelect={(r) =>
              onChange({ from: formatISODate(r?.from), to: formatISODate(r?.to) })
            }
          />
        </PopoverContent>
      </Popover>
      {hasValue && (
        <button
          type="button"
          title={clearLabel}
          aria-label={clearLabel}
          onClick={() => onChange({ from: "", to: "" })}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
