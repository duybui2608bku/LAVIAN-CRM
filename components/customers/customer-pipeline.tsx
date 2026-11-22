"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Tooltip } from "antd";
import dayjs from "dayjs";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Minus } from "lucide-react";

import { getAdMessages } from "@/app/(app)/customers/actions";
import { DASH } from "@/components/common/cells";
import { Section } from "@/components/common/section";
import { StatCard } from "@/components/common/stat-card";
import { formatRupiah } from "@/lib/currency";
import { matchesCustomerFilters } from "@/lib/customers";
import { DEPOSITED_OR_LATER } from "@/lib/reports";
import type { VisitStatus } from "@/types/appointment";
import type { Customer } from "@/types/customer";

export type PipelineAppointment = {
  customer_id: string;
  scheduled_at: string;
  checked_in: boolean;
  visit_status: VisitStatus; // cột Sales Status
  service_categories: string[]; // nhóm dịch vụ — hiện sau SĐT ở ô Khách hàng
};

type Card = {
  key: string;
  value: number | null; // null = đang tải / lỗi
  error?: string;
  dash?: boolean; // nối bằng "–" thay vì mũi tên
  hint?: string; // dòng phụ dưới số, vd. tổng tiền cọc
};

/**
 * Pipeline trên bảng /customers.
 * - Nhóm Data: theo khoảng ngày tạo đang lọc (chưa lọc → hôm nay).
 *   Đặt cọc/Lịch hẹn/Show-up đếm dồn trong số khách Data của khoảng đó.
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
  const showUp = new Set(appointments.filter((a) => a.checked_in).map((a) => a.customer_id));
  const dayOf = (a: PipelineAppointment) => dayjs(a.scheduled_at).format("YYYY-MM-DD");
  const countDay = (from: string, to: string) =>
    appointments.filter((a) => {
      const d = dayOf(a);
      return d >= from && d <= to;
    }).length;

  const deposited = data.filter((c) => DEPOSITED_OR_LATER.has(c.stage));

  const dataCards: Card[] = [
    {
      key: "messages",
      value: loading || !messages ? null : (messages.value ?? null),
      error: loading ? undefined : messages?.error,
    },
    { key: "data", value: data.length },
    { key: "booked", value: data.filter((c) => booked.has(c.id)).length },
    {
      key: "deposited",
      value: deposited.length,
      hint: formatRupiah(deposited.reduce((s, c) => s + Number(c.deposit_amount ?? 0), 0)),
    },
    { key: "showUp", value: data.filter((c) => showUp.has(c.id)).length },
  ];

  const appointmentCards: Card[] = [
    { key: "total", value: countDay(rangeFrom, rangeTo) },
    { key: "todayAppointments", value: countDay(today, today), dash: true },
    { key: "tomorrow", value: countDay(tomorrow, tomorrow) },
  ];

  const fmt = (d: string) => dayjs(d).format("DD/MM");
  const rangeLabel =
    rangeFrom === rangeTo
      ? rangeFrom === today ? t("today") : fmt(rangeFrom)
      : `${fmt(rangeFrom)} – ${fmt(rangeTo)}`;

  const renderCard = (c: Card, i: number) => (
    <li key={c.key} className="flex min-w-0 items-center gap-2 lg:flex-1">
      {i > 0 &&
        (c.dash ? (
          <Minus aria-hidden className="hidden size-4 shrink-0 text-muted-foreground lg:block" />
        ) : (
          <ArrowRight aria-hidden className="hidden size-4 shrink-0 text-muted-foreground lg:block" />
        ))}
      <div className="min-w-0 flex-1">
        <StatCard
          label={t(c.key)}
          loading={c.value === null && !c.error}
          value={c.error ? <Tooltip title={c.error}>{DASH}</Tooltip> : c.value?.toLocaleString(locale)}
          hint={c.hint}
        />
      </div>
    </li>
  );

  const group = (title: React.ReactNode, cards: Card[]) => (
    <Section title={title}>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">{cards.map(renderCard)}</ol>
    </Section>
  );

  return (
    <div className="grid gap-4 rounded-xl border border-border bg-muted/60 p-3 sm:p-4 xl:grid-cols-[5fr_3fr]">
      {group(
        <>
          {t("dataGroup")}
          <span className="font-normal text-muted-foreground"> · {rangeLabel}</span>
        </>,
        dataCards,
      )}
      {group(t("appointmentGroup"), appointmentCards)}
    </div>
  );
}
