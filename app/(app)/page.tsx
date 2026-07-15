import { getLocale } from "next-intl/server";

import { sumPayments } from "@/lib/appointments";
import { formatVnd } from "@/lib/currency";
import { serviceName } from "@/lib/customers";
import { defaultLocale, isLocale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import type { Service } from "@/types/service";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LedgerMetricRow = {
  service_id: string;
  total_amount: number | null;
  appointment_payments: { kind: "deposit" | "payment" | "refund"; amount: number }[] | null;
};

type PivotRow = {
  service: Service;
  revenue: number;
  paid: number;
  outstanding: number;
};

const HOME_COPY = {
  vi: {
    title: "Tổng quan doanh thu",
    description:
      "Bảng pivot tổng hợp tổng giá liệu trình, thực thu và công nợ theo từng dịch vụ.",
    pivotTitle: "Thống kê doanh số theo dịch vụ",
    colService: "Dịch vụ",
    colRevenue: "Doanh số",
    colPaid: "Thực thu",
    colOutstanding: "Công nợ",
    total: "Tổng cộng",
    empty: "Chưa có dữ liệu số liệu.",
  },
  en: {
    title: "Revenue overview",
    description:
      "Pivot table of course revenue, collected payments, and outstanding balance by service.",
    pivotTitle: "Revenue by service",
    colService: "Service",
    colRevenue: "Revenue",
    colPaid: "Collected",
    colOutstanding: "Outstanding",
    total: "Total",
    empty: "No revenue data yet.",
  },
  id: {
    title: "Ringkasan pendapatan",
    description:
      "Tabel pivot total harga paket, pembayaran masuk, dan piutang per layanan.",
    pivotTitle: "Pendapatan per layanan",
    colService: "Layanan",
    colRevenue: "Pendapatan",
    colPaid: "Pembayaran masuk",
    colOutstanding: "Piutang",
    total: "Total",
    empty: "Belum ada data pendapatan.",
  },
} as const;

export default async function Home() {
  const [locale, supabase] = await Promise.all([getLocale(), createClient()]);
  const currentLocale = isLocale(locale) ? locale : defaultLocale;
  const copy = HOME_COPY[currentLocale];

  const [servicesRes, ledgersRes] = await Promise.all([
    supabase.from("services").select("*").order("sort_order", { ascending: true }),
    supabase
      .from("service_ledgers")
      .select("service_id, total_amount, appointment_payments(kind, amount)"),
  ]);

  const services = (servicesRes.data as Service[] | null) ?? [];
  const ledgers = (ledgersRes.data as LedgerMetricRow[] | null) ?? [];

  const pivot = new Map<string, PivotRow>(
    services.map((service) => [
      service.id,
      { service, revenue: 0, paid: 0, outstanding: 0 },
    ]),
  );

  for (const ledger of ledgers) {
    const row = pivot.get(ledger.service_id);
    if (!row) continue;

    const revenue = ledger.total_amount ?? 0;
    const paid = sumPayments(ledger.appointment_payments);
    const outstanding = Math.max(revenue - paid, 0);

    row.revenue += revenue;
    row.paid += paid;
    row.outstanding += outstanding;
  }

  const rows = Array.from(pivot.values()).filter(
    (row) => row.service.is_active || row.revenue > 0 || row.paid > 0 || row.outstanding > 0,
  );

  const totals = rows.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      paid: acc.paid + row.paid,
      outstanding: acc.outstanding + row.outstanding,
    }),
    { revenue: 0, paid: 0, outstanding: 0 },
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>

      <section className="rounded-xl border bg-background shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {copy.pivotTitle}
          </h2>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.colService}</TableHead>
              <TableHead className="text-right">{copy.colRevenue}</TableHead>
              <TableHead className="text-right">{copy.colPaid}</TableHead>
              <TableHead className="text-right">{copy.colOutstanding}</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.service.id}>
                  <TableCell className="font-medium">
                    {serviceName(row.service, currentLocale)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(row.revenue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(row.paid)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVnd(row.outstanding)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  {copy.empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TableCell>{copy.total}</TableCell>
              <TableCell className="text-right">
                {formatVnd(totals.revenue)}
              </TableCell>
              <TableCell className="text-right">{formatVnd(totals.paid)}</TableCell>
              <TableCell className="text-right">
                {formatVnd(totals.outstanding)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </section>
    </div>
  );
}
