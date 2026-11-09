"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Tooltip } from "antd";
import dayjs from "dayjs";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CircleCheck,
  MessageCircle,
  Minus,
  Moon,
  Phone,
  Sun,
  Wallet,
} from "lucide-react";

import { getAdMessages } from "@/app/(app)/customers/actions";
import { matchesCustomerFilters } from "@/lib/customers";
import { DEPOSITED_OR_LATER } from "@/lib/reports";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types/customer";

export type PipelineAppointment = {
  customer_id: string;
  scheduled_at: string;
  checked_in: boolean;
};


type Tone = "info" | "warning" | "primary" | "success";
const TONE: Record<Tone, string> = {
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
};

type Card = {
  key: string;
  icon: React.ElementType;
  tone: Tone;
  value: number | null; // null = đang tải / lỗi
  error?: string;
  label?: string; // mặc định t(key)
  dash?: boolean; // nối bằng "–" thay vì mũi tên
};

/**
 * Pipeline trên bảng /customers.
 * - Nhóm Data: theo khoảng ngày tạo đang lọc (chưa lọc → hôm nay).
 *   Đặt cọc/Lịch hẹn/Đã đến đếm dồn trong số khách Data của khoảng đó.
 * - Nhóm Lịch hẹn: tổng theo khoảng đang lọc; hôm nay/ngày mai cố định theo giờ hiện tại.
 */
export function CustomerPipeline({
  customers,
  appointments,
  from,
  to,
}: {
  customers: Customer[];
  appointments: PipelineAppointment[];
  from: string;
  to: string;
}) {
  const t = useTranslations("customers.pipeline");
  const locale = useLocale();

  const today = dayjs().format("YYYY-MM-DD");
  const tomorrow = dayjs().add(1, "day").format("YYYY-MM-DD");
  const rangeFrom = from || to || today;
  const rangeTo = to || from || today;

  // Tin nhắn FB — gọi server mỗi khi đổi khoảng ngày; bỏ kết quả của request cũ.
  const [messages, setMessages] = useState<{ value?: number; error?: string } | null>(null);
  const [loading, startLoading] = useTransition();
  const requestId = useRef(0);
  useEffect(() => {
    const current = ++requestId.current;
    startLoading(async () => {
      const res = await getAdMessages(rangeFrom, rangeTo);
      if (current === requestId.current) setMessages({ value: res.messages, error: res.error });
    });
  }, [rangeFrom, rangeTo]);

  const data = customers.filter((c) => matchesCustomerFilters(c, { from: rangeFrom, to: rangeTo }));
  const booked = new Set(appointments.map((a) => a.customer_id));
  const visited = new Set(appointments.filter((a) => a.checked_in).map((a) => a.customer_id));
  const dayOf = (a: PipelineAppointment) => dayjs(a.scheduled_at).format("YYYY-MM-DD");
  const countDay = (from: string, to: string) =>
    appointments.filter((a) => {
      const d = dayOf(a);
      return d >= from && d <= to;
    }).length;

  const dataCards: Card[] = [
    {
      key: "messages",
      icon: MessageCircle,
      tone: "info",
      value: loading || !messages ? null : (messages.value ?? null),
      error: loading ? undefined : messages?.error,
    },
    { key: "data", icon: Phone, tone: "info", value: data.length },
    {
      key: "deposited",
      icon: Wallet,
      tone: "warning",
      value: data.filter((c) => DEPOSITED_OR_LATER.has(c.stage)).length,
    },
    {
      key: "booked",
      icon: CalendarDays,
      tone: "primary",
      value: data.filter((c) => booked.has(c.id)).length,
    },
    {
      key: "visited",
      icon: CircleCheck,
      tone: "success",
      value: data.filter((c) => visited.has(c.id)).length,
    },
  ];

  const appointmentCards: Card[] = [
    { key: "total", icon: CalendarDays, tone: "primary", value: countDay(rangeFrom, rangeTo) },
    { key: "todayAppointments", icon: Sun, tone: "warning", value: countDay(today, today), dash: true },
    { key: "tomorrow", icon: Moon, tone: "primary", value: countDay(tomorrow, tomorrow) },
  ];

  const fmt = (d: string) => dayjs(d).format("DD/MM");
  const rangeLabel =
    rangeFrom === rangeTo
      ? rangeFrom === today ? t("today") : fmt(rangeFrom)
      : `${fmt(rangeFrom)} – ${fmt(rangeTo)}`;

  appointmentCards[0].label = t("total", { range: rangeLabel });

  const renderCard = (c: Card, i: number) => (
    <li key={c.key} className="flex min-w-0 items-center gap-2 lg:flex-1">
      {i > 0 &&
        (c.dash ? (
          <Minus aria-hidden className="hidden size-4 shrink-0 text-muted-foreground lg:block" />
        ) : (
          <ArrowRight aria-hidden className="hidden size-4 shrink-0 text-muted-foreground lg:block" />
        ))}
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-border bg-card p-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", TONE[c.tone])}>
          <c.icon className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="text-lg leading-6 font-semibold tabular-nums">
            {c.error ? (
              <Tooltip title={c.error}>
                <span className="text-muted-foreground">—</span>
              </Tooltip>
            ) : c.value === null ? (
              <span className="inline-block h-5 w-8 animate-pulse rounded bg-muted align-middle" />
            ) : (
              c.value.toLocaleString(locale)
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{c.label ?? t(c.key)}</p>
        </div>
      </div>
    </li>
  );

  const group = (title: React.ReactNode, Icon: React.ElementType, tone: Tone, cards: Card[]) => (
    <section className="min-w-0 space-y-2">
      <h2 className={cn("flex items-center gap-1.5 text-sm font-medium", TONE[tone].split(" ")[1])}>
        <Icon className="size-4" />
        {title}
      </h2>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">{cards.map(renderCard)}</ol>
    </section>
  );

  return (
    <div className="grid gap-4 rounded-xl border border-border bg-muted/60 p-3 sm:p-4 xl:grid-cols-[5fr_3fr]">
      {group(
        <>
          {t("dataGroup")}
          <span className="font-normal text-muted-foreground">· {rangeLabel}</span>
        </>,
        BarChart3,
        "info",
        dataCards,
      )}
      {group(t("appointmentGroup"), CalendarDays, "primary", appointmentCards)}
    </div>
  );
}
