"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { getAdsStats, type AdsStats } from "@/app/(app)/marketing/actions";
import { DateRangePicker } from "@/components/common/date-picker";
import { PageHeader } from "@/components/layout/page";
import { formatRupiah } from "@/lib/currency";
import { formatISODate } from "@/lib/date";
import { cn } from "@/lib/utils";

/** Chia an toàn: thiếu số hoặc mẫu 0 → null ("—"). */
const ratio = (a: number | null, b: number | null) =>
  a != null && b ? Math.round(a / b) : null;

export function AdsStatsView() {
  const t = useTranslations("marketing");
  const locale = useLocale();
  const today = formatISODate(new Date());
  const [range, setRange] = React.useState({ from: today, to: today });
  const [stats, setStats] = React.useState<AdsStats | null>(null);
  const [pending, startTransition] = React.useTransition();
  const requestId = React.useRef(0);

  React.useEffect(() => {
    const current = ++requestId.current;
    startTransition(async () => {
      const next = await getAdsStats(range.from, range.to || range.from);
      if (current === requestId.current) setStats(next);
    });
  }, [range]);

  const money = (n: number | null) => (n == null ? null : formatRupiah(n));
  const count = (n: number | null) => (n == null ? null : n.toLocaleString(locale));
  const e = stats?.errors;
  const s = stats;
  const cards: { key: string; value: string | null; error?: string }[] = [
    { key: "spend", value: money(s?.spend ?? null), error: e?.fb },
    { key: "messages", value: count(s?.messages ?? null), error: e?.fb },
    {
      key: "costPerMessage",
      value: money(ratio(s?.spend ?? null, s?.messages ?? null)),
      error: e?.fb,
    },
    { key: "leads", value: count(s?.leads ?? null), error: e?.smax },
    {
      key: "costPerLead",
      value: money(ratio(s?.spend ?? null, s?.leads ?? null)),
      error: e?.fb ?? e?.smax,
    },
    { key: "appointments", value: count(s?.appointments ?? null), error: e?.db },
    { key: "visited", value: count(s?.visited ?? null), error: e?.db },
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <>
            {stats && pending && (
              <RefreshCw className="size-4 shrink-0 animate-spin text-muted-foreground" />
            )}
            <DateRangePicker
              from={range.from}
              to={range.to}
              onChange={(next) =>
                setRange(next.from ? next : { from: today, to: today })
              }
              allowClear={false}
              className="w-full sm:w-64"
            />
          </>
        }
      />

      {stats?.error && <p className="text-sm text-destructive">{stats.error}</p>}

      <div
        className={cn(
          "grid grid-cols-2 gap-2 transition-opacity duration-200 sm:gap-3 lg:grid-cols-4",
          stats && pending && "opacity-60",
        )}
      >
        {cards.map((card) => (
          <div key={card.key} className="surface flex min-w-0 flex-col p-3 sm:p-4">
            <p className="truncate text-xs font-medium text-muted-foreground">
              {t(card.key)}
            </p>
            <span className="mt-1 truncate text-lg font-semibold tracking-tight tabular-nums sm:text-2xl">
              {!stats ? (
                <span className="inline-block h-6 w-20 animate-pulse rounded-md bg-muted sm:h-7 sm:w-24" />
              ) : (
                (card.value ?? "—")
              )}
            </span>
            {card.error && (
              <p className="mt-1 text-xs text-destructive">{card.error}</p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
