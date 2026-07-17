"use client";

import * as React from "react";
import {
  Calculator,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CircleDollarSign,
  MapPinCheck,
  MessageCircle,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { getMarketingStats, type DashboardStats } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/currency";
import { formatISODate } from "@/lib/date";
import { DateRangePicker } from "@/components/common/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CustomerCardKey =
  | "spend"
  | "costPerMessage"
  | "messages"
  | "leads"
  | "appointments"
  | "visited"
  | "revenue";

export function MarketingStats({ showSpend = false }: { showSpend?: boolean }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const today = formatISODate(new Date());
  const [range, setRange] = React.useState({ from: today, to: today });
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!range.from) return;
    const from = range.from;
    const to = range.to || range.from;
    startTransition(async () => {
      setStats(await getMarketingStats(from, to, showSpend));
    });
  }, [range, showSpend]);

  const num = (n: number | null) => (n == null ? null : n.toLocaleString(locale));
  const costPerMessage =
    stats?.spend != null && stats.messages != null && stats.messages > 0
      ? Math.round(stats.spend / stats.messages)
      : null;
  const customerCards: {
    key: CustomerCardKey;
    icon: LucideIcon;
    value: string | null;
    error?: string;
  }[] = [
    ...(showSpend
      ? [
          {
            key: "spend" as const,
            icon: CircleDollarSign,
            value: stats?.spend != null ? formatVnd(stats.spend) : null,
            error: stats?.errors.fb,
          },
          {
            key: "costPerMessage" as const,
            icon: Calculator,
            value: costPerMessage != null ? formatVnd(costPerMessage) : null,
            error: stats?.errors.fb ?? stats?.errors.smax,
          },
        ]
      : []),
    { key: "messages", icon: MessageCircle, value: stats ? num(stats.messages) : null, error: stats?.errors.smax },
    { key: "leads", icon: Phone, value: stats ? num(stats.leads) : null, error: stats?.errors.smax },
    { key: "appointments", icon: CalendarCheck, value: stats ? num(stats.appointments) : null, error: stats?.errors.db },
    { key: "visited", icon: MapPinCheck, value: stats ? num(stats.visited) : null, error: stats?.errors.db },
    { key: "revenue", icon: CircleDollarSign, value: stats?.revenue != null ? formatVnd(stats.revenue) : null, error: stats?.errors.db },
  ];

  const appointmentCards = [
    { key: "totalAppointments", icon: CalendarCheck, values: stats?.appointmentSummary.total },
    { key: "todayAppointments", icon: CalendarDays, values: stats?.appointmentSummary.today },
    { key: "tomorrowAppointments", icon: CalendarPlus, values: stats?.appointmentSummary.tomorrow },
  ] as const;

  const value = (displayValue: string | null) =>
    !stats && pending ? (
      <span className="inline-block h-7 w-24 animate-pulse rounded bg-muted" />
    ) : (
      (displayValue ?? "—")
    );

  return (
    <div className="space-y-6">
      <DateRangePicker
        from={range.from}
        to={range.to}
        onChange={(next) => setRange(next.from ? next : { from: today, to: today })}
        placeholder={t("range")}
        clearLabel={t("clear")}
        className="w-full max-w-64"
      />

      {stats?.error && <p className="text-sm text-destructive">{stats.error}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("customerSection")}</h2>
        <div className={cn("grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-4", pending && "opacity-60")}>
          {customerCards.map((card) => (
            <MetricCard key={card.key} label={t(card.key)} icon={card.icon} value={value(card.value)} error={card.error} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("appointmentSection")}</h2>
        <div className={cn("grid gap-4 transition-opacity lg:grid-cols-3", pending && "opacity-60")}>
          {appointmentCards.map((card) => (
            <div key={card.key} className="rounded-xl border bg-background p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{t(card.key)}</span>
                <card.icon className="size-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight">{value(num(card.values?.total ?? null))}</div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("deposited")}</p>
                  <p className="mt-1 font-semibold">{value(num(card.values?.deposited ?? null))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("notDeposited")}</p>
                  <p className="mt-1 font-semibold">{value(num(card.values?.notDeposited ?? null))}</p>
                </div>
              </div>
              {stats?.errors.db && <p className="mt-2 text-xs text-destructive">{stats.errors.db}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{t("staffSection")}</h2>
          <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("staffName")}</TableHead>
                  <TableHead className="text-right">{t("staffCustomers")}</TableHead>
                  <TableHead className="text-right">{t("staffPhoneLeads")}</TableHead>
                  <TableHead className="text-right">{t("staffWhatsappLeads")}</TableHead>
                  <TableHead className="text-right">{t("staffPhoneRate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.staffStats?.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">{row.customers.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right">{row.phoneLeads.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right">{row.whatsappLeads.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right">{row.phoneRate.toLocaleString(locale, { maximumFractionDigits: 2 })}%</TableCell>
                  </TableRow>
                ))}
                {!stats?.errors.staff && stats?.staffStats?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">{t("noStaffStats")}</TableCell>
                  </TableRow>
                )}
                {!stats && pending && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">{t("loading")}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {stats?.errors.staff && <p className="text-sm text-destructive">{stats.errors.staff}</p>}
      </section>

    </div>
  );
}

function MetricCard({ label, icon: Icon, value, error }: { label: string; icon: LucideIcon; value: React.ReactNode; error?: string }) {
  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-muted-foreground">{label}</span>
        <Icon className="size-4 shrink-0 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
