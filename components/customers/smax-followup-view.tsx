"use client";

import * as React from "react";
import { Alert, Button, Table, type TableProps } from "antd";
import { useLocale, useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";

import { getFollowupReport } from "@/app/(app)/customers/smax-report/actions";
import { ClearableSelect } from "@/components/common/clearable-select";
import { DateRangePicker } from "@/components/common/date-picker";
import { initialRange } from "@/components/common/date-range-filter";
import { UserAvatar } from "@/components/common/user-avatar";
import { StatCard } from "@/components/common/stat-card";
import { PageToolbar } from "@/components/layout/page";
import { INBOX_STAFF, UNASSIGNED, type FollowupCounts, type FollowupReport } from "@/lib/smax-inbox";
import { cn } from "@/lib/utils";

type Result = Awaited<ReturnType<typeof getFollowupReport>>;

function useFormat() {
  const locale = useLocale();
  return {
    num: (v: number) => v.toLocaleString(locale),
    pct: (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "-"),
  };
}

export function SmaxFollowupView() {
  const t = useTranslations("smaxFollowup");
  const tr = useTranslations("smaxReport");
  const { num, pct } = useFormat();
  const [range, setRange] = React.useState(() => initialRange("today"));
  const [staff, setStaff] = React.useState("");
  const [result, setResult] = React.useState<Result | null>(null);
  const [pending, startTransition] = React.useTransition();
  const requestId = React.useRef(0);

  const load = React.useCallback(() => {
    const current = ++requestId.current;
    startTransition(async () => {
      const next = await getFollowupReport(range.from, range.to);
      if (current === requestId.current) setResult(next);
    });
  }, [range]);
  React.useEffect(load, [load]);

  const report = result?.data ?? null;
  // Lọc Telesales chỉ đổi phạm vi số liệu (tính sẵn ở server) — không gọi lại API.
  const c: FollowupCounts | null = report
    ? staff
      ? (report.staff.find((s) => s.alias === staff)?.counts ?? null)
      : report.total
    : null;
  const loading = !result;
  const show = (v: (c: FollowupCounts) => React.ReactNode) => (c ? v(c) : "-");

  const staffOptions = [
    ...INBOX_STAFF.map((s) => ({ value: s.alias, label: s.name })),
    { value: UNASSIGNED, label: tr("unassigned") },
  ];

  return (
    <>
      <PageToolbar>
        <DateRangePicker
          from={range.from}
          to={range.to}
          allowClear={false}
          onChange={(r) => r.from && setRange({ from: r.from, to: r.to || r.from })}
        />
        <ClearableSelect
          value={staff}
          onChange={setStaff}
          options={staffOptions}
          placeholder={tr("allStaff")}
          ariaLabel={tr("staff")}
          className="w-48 max-sm:w-full"
          searchable
        />
        <Button icon={<RefreshCw className={cn("size-4", pending && "animate-spin")} />} onClick={load}>
          {tr("refresh")}
        </Button>
      </PageToolbar>

      {result?.error ? <Alert type="error" showIcon title={result.error} /> : null}

      <div className={cn("flex flex-col gap-4 transition-opacity duration-200", pending && result && "opacity-60")}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label={t("worked")} loading={loading} value={show((c) => num(c.worked))} hint={t("hint.worked")} />
          <StatCard
            label={t("quality")}
            loading={loading}
            value={show((c) => (
              <span className="flex items-baseline gap-2">
                {num(c.converted)}
                <span className="text-sm font-medium text-muted-foreground">{pct(c.converted, c.worked)}</span>
              </span>
            ))}
            hint={c ? t("hint.quality", { booking: num(c.bookingOld), showUp: num(c.showUp) }) : undefined}
          />
          <StatCard label={t("bookingNew")} loading={loading} value={show((c) => num(c.bookingNew))} hint={t("hint.bookingNew")} />
          <StatCard label={t("bookingOld")} loading={loading} value={show((c) => num(c.bookingOld))} hint={t("hint.bookingOld")} />
          <StatCard
            label={t("bookingTotal")}
            loading={loading}
            value={show((c) => num(c.bookingNew + c.bookingOld))}
            hint={t("hint.bookingTotal")}
          />
        </div>

        {!staff ? (
          <section className="surface flex min-w-0 flex-col gap-3 p-4">
            <h2 className="text-sm font-semibold">{tr("byStaff")}</h2>
            <StaffTable report={report} avatars={result?.avatars} loading={loading} onPick={setStaff} />
          </section>
        ) : null}
      </div>
    </>
  );
}

type StaffRow = { alias: string; name: string; c: FollowupCounts };

/** Bảng theo Telesales; bấm dòng để lọc theo người đó. */
function StaffTable({
  report,
  avatars,
  loading,
  onPick,
}: {
  report: FollowupReport | null;
  avatars?: Result["avatars"];
  loading: boolean;
  onPick: (alias: string) => void;
}) {
  const t = useTranslations("smaxFollowup");
  const tr = useTranslations("smaxReport");
  const { num, pct } = useFormat();
  const rows: StaffRow[] = (report?.staff ?? [])
    .map((s) => ({ alias: s.alias, name: s.alias === UNASSIGNED ? tr("unassigned") : s.name, c: s.counts }))
    // Bào nhiều nhất lên đầu; "Chưa gán" luôn cuối.
    .sort((a, b) => Number(a.alias === UNASSIGNED) - Number(b.alias === UNASSIGNED) || b.c.worked - a.c.worked);

  const numCol = (key: keyof FollowupCounts, title: string, strong?: boolean) => ({
    key,
    title,
    align: "right" as const,
    render: (_: unknown, r: StaffRow) => <span className={cn("tabular-nums", strong && "font-semibold")}>{num(r.c[key])}</span>,
  });

  const columns: TableProps<StaffRow>["columns"] = [
    {
      key: "name",
      title: tr("staff"),
      render: (_, r) => (
        <span className={cn("flex items-center gap-2 whitespace-nowrap font-medium", r.alias === UNASSIGNED && "text-muted-foreground")}>
          {r.alias === UNASSIGNED ? null : <UserAvatar src={avatars?.[r.alias]} size={24} />}
          {r.name}
        </span>
      ),
    },
    numCol("worked", t("worked"), true),
    numCol("bookingOld", t("bookingOld")),
    numCol("showUp", t("showUp")),
    {
      key: "quality",
      title: t("quality"),
      align: "right",
      render: (_, r) => (
        <span className="whitespace-nowrap tabular-nums">
          {num(r.c.converted)}
          <span className="ml-1.5 text-xs text-muted-foreground">{pct(r.c.converted, r.c.worked)}</span>
        </span>
      ),
    },
    numCol("bookingNew", t("bookingNew")),
    {
      key: "bookingTotal",
      title: t("bookingTotal"),
      align: "right",
      render: (_, r) => <span className="font-semibold tabular-nums">{num(r.c.bookingNew + r.c.bookingOld)}</span>,
    },
  ];

  return (
    <Table<StaffRow>
      rowKey="alias"
      columns={columns}
      dataSource={rows}
      pagination={false}
      size="middle"
      loading={loading}
      scroll={{ x: "max-content" }}
      onRow={(r) => ({ onClick: () => onPick(r.alias), className: "cursor-pointer" })}
    />
  );
}
