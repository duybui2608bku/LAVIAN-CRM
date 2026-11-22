"use client";

import { useState } from "react";
import { Input, Select, Tag, type TableProps } from "antd";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { CardDrawer, CardStatusTag, DueText, toursOfCard, usageOf, type CardMe } from "@/components/cards/card-drawer";
import { DataTable } from "@/components/common/data-table";
import { DateRangePicker } from "@/components/common/date-picker";
import { NamePhone } from "@/components/common/name-phone";
import { StatCard } from "@/components/common/stat-card";
import type { StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { cardDone, cardMoney } from "@/lib/cards";
import { formatRupiah } from "@/lib/currency";
import { matchesNameOrPhone } from "@/lib/customers";
import type { TreatmentCard } from "@/types/card";
import type { Service } from "@/types/service";
import type { Tour } from "@/types/tour";

const STATUSES = ["active", "debt", "done", "cancelled"] as const;
const million = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

/** Bảng thẻ liệu trình — lọc theo ngày bán (doanh số theo kỳ), trạng thái, tìm mã / tên / SĐT. */
export function CardsView({ cards, cardTours, services, staff, me }: {
  cards: TreatmentCard[];
  cardTours: Tour[];
  services: Service[];
  staff: StaffRef[];
  me: CardMe;
}) {
  const t = useTranslations("cards");
  const [search, setSearch] = useState("");
  const [dates, setDates] = useState({ from: "", to: "" });
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const used = usageOf(cardTours);
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? "—";

  const rows = cards.map((card) => ({ ...card, money: cardMoney(card) }));
  const matches = (c: (typeof rows)[number]) => {
    if (status === "cancelled") return !!c.cancelled_at;
    if (c.cancelled_at) return false; // thẻ huỷ chỉ hiện khi lọc "Đã huỷ"
    if (status === "debt") return c.money.due > 0;
    if (status === "done") return cardDone(c.items, used);
    if (status === "active") return !cardDone(c.items, used);
    return true;
  };
  const day = (iso: string) => dayjs(iso).format("YYYY-MM-DD");
  const q = search.trim().toLowerCase();
  const filtered = rows.filter((c) => matches(c)
    && (!dates.from || (day(c.created_at) >= dates.from && day(c.created_at) <= (dates.to || dates.from)))
    && (!q || c.code.toLowerCase().includes(q) || matchesNameOrPhone(c.customer?.full_name ?? "", c.customer?.phone ?? "", search)));
  const sum = (pick: (c: (typeof rows)[number]) => number) => filtered.filter((c) => !c.cancelled_at).reduce((s, c) => s + pick(c), 0);
  const open = openId ? cards.find((c) => c.id === openId) : undefined;
  const reset = () => setPage(1);

  const columns: TableProps<(typeof rows)[number]>["columns"] = [
    { title: t("code"), width: 130, fixed: "left", render: (_, c) => <span className="font-medium text-primary">{c.code}</span> },
    { title: t("customer"), width: 200, render: (_, c) => <NamePhone name={c.customer?.full_name ?? "—"} phone={c.customer?.phone} /> },
    { title: t("services"), width: 300, render: (_, c) => <div className="flex flex-wrap gap-1">
      {c.items.map((i) => <Tag key={i.id} className={i.refunded_at ? "me-0 line-through opacity-60" : "me-0"}>
        {serviceName(i.service_id)} · {used(i.id)}/{i.sessions}
      </Tag>)}
    </div> },
    { title: t("value"), width: 140, align: "right", render: (_, c) => <span className="tabular-nums">{formatRupiah(c.money.value)}</span> },
    { title: t("collected"), width: 140, align: "right", render: (_, c) => <span className="tabular-nums text-success">{formatRupiah(c.money.collected)}</span> },
    { title: t("due"), width: 140, align: "right", render: (_, c) => <DueText due={c.money.due} /> },
    { title: t("createdAt"), width: 110, render: (_, c) => dayjs(c.created_at).format("DD/MM/YYYY") },
    { title: t("statusLabel"), width: 120, render: (_, c) => <CardStatusTag card={c} tours={cardTours} /> },
  ];

  return <Page>
    <PageHeader title={t("title")} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label={t("statCount")} value={filtered.filter((c) => !c.cancelled_at).length} />
      <StatCard label={t("statValue")} value={million.format(sum((c) => c.money.value) / 1e6)} hint={t("millionIdr")} />
      <StatCard label={t("statCollected")} value={million.format(sum((c) => c.money.collected) / 1e6)} hint={t("millionIdr")} />
      <StatCard label={t("statDue")} value={million.format(sum((c) => Math.max(c.money.due, 0)) / 1e6)} hint={t("millionIdr")} />
    </div>
    <PageToolbar>
      <Input value={search} allowClear className="w-full sm:max-w-64" placeholder={t("search")} aria-label={t("search")}
        prefix={<Search className="size-4" />} onChange={(e) => { setSearch(e.target.value); reset(); }} />
      <DateRangePicker from={dates.from} to={dates.to} onChange={(r) => { setDates(r); reset(); }} placeholder={t("allDates")} />
      <Select value={status} aria-label={t("statusLabel")} className="min-w-40" onChange={(v) => { setStatus(v); reset(); }}
        options={[{ value: "all", label: t("allStatuses") }, ...STATUSES.map((s) => ({ value: s, label: t(`filter.${s}`) }))]} />
    </PageToolbar>
    <DataTable columns={columns} dataSource={filtered} scroll={{ x: 1280 }} empty={t("empty")} page={page} onPageChange={setPage}
      onRow={(c) => ({ onClick: () => setOpenId(c.id), className: "cursor-pointer" })} />
    {open ? <CardDrawer key={open.id} card={open} tours={toursOfCard(open, cardTours)} services={services} staff={staff} me={me}
      onClose={() => setOpenId(null)} /> : null}
  </Page>;
}
