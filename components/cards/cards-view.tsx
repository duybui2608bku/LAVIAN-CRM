"use client";

import { Fragment, useState } from "react";
import { Popover, Select, type TableProps } from "antd";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { CreditCard, HandCoins, ReceiptText, Wallet } from "lucide-react";
import { CardDrawer, CardStatusTag, DueText, toursOfCard, usageOf, type CardMe } from "@/components/cards/card-drawer";
import { useCustomer360 } from "@/components/customers/customer-360/customer-360-modal";
import { ClearableSelect } from "@/components/common/clearable-select";
import { DataTable } from "@/components/common/data-table";
import { DateRangePicker } from "@/components/common/date-picker";
import { ClearFilters, SearchInput } from "@/components/common/filter-controls";
import { NamePhone } from "@/components/common/name-phone";
import { StatCard } from "@/components/common/stat-card";
import { staffLabel, staffName, type StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { cardMoney, cardStatus, isTourable } from "@/lib/cards";
import { formatRupiah, formatRupiahCompact } from "@/lib/currency";
import { matchesNameOrPhone } from "@/lib/customers";
import type { CardItem, TreatmentCard } from "@/types/card";
import type { Service } from "@/types/service";
import type { Tour } from "@/types/tour";

const STATUSES = ["active", "debt", "done", "refunded", "cancelled"] as const;
const MAX_ITEMS = 2;

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
  const [status, setStatus] = useState("");
  const [creator, setCreator] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const used = usageOf(cardTours);
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? "—";
  const itemText = (i: CardItem) => <span key={i.id} className={i.refunded_at ? "line-through opacity-60" : undefined}>
    {serviceName(i.service_id)}
    {isTourable(i) ? <span className="text-muted-foreground tabular-nums"> {used(i.id)}/{i.sessions}</span> : null}
  </span>;

  const rows = cards.map((card) => ({ ...card, money: cardMoney(card) }));
  const matches = (c: (typeof rows)[number]) => {
    if (status === "cancelled") return !!c.cancelled_at;
    if (c.cancelled_at) return false; // thẻ huỷ chỉ hiện khi lọc "Đã huỷ"
    if (status === "debt") return c.money.due > 0;
    return !status || cardStatus(c, used) === status;
  };
  const day = (iso: string) => dayjs(iso).format("YYYY-MM-DD");
  const q = search.trim().toLowerCase();
  const filtered = rows.filter((c) => matches(c)
    && (!creator || c.created_by === creator)
    && (!dates.from || (day(c.created_at) >= dates.from && day(c.created_at) <= (dates.to || dates.from)))
    && (!q || c.code.toLowerCase().includes(q) || matchesNameOrPhone(c.customer?.full_name ?? "", c.customer?.phone ?? "", search)));
  const sum = (pick: (c: (typeof rows)[number]) => number) => filtered.filter((c) => !c.cancelled_at).reduce((s, c) => s + pick(c), 0);
  const open = openId ? cards.find((c) => c.id === openId) : undefined;
  const reset = () => setPage(1);
  const clearFilters = () => { setSearch(""); setDates({ from: "", to: "" }); setStatus(""); setCreator(""); reset(); };
  // Popup 360° khi bấm tên khách; Trước/Tiếp theo thứ tự bảng đang lọc.
  const c360 = useCustomer360({ ids: filtered.map((c) => c.customer_id), staff });
  const staffById = new Map(staff.map((s) => [s.id, s]));
  // Bộ lọc người tạo: chỉ những người đã tạo thẻ.
  const creators = [...new Set(cards.map((c) => c.created_by).filter((id): id is string => !!id))]
    .map((id) => staffById.get(id)).filter((s): s is StaffRef => !!s);

  const columns: TableProps<(typeof rows)[number]>["columns"] = [
    { title: t("createdAt"), width: 110, fixed: "left", render: (_, c) => <div className="leading-tight tabular-nums">
      {dayjs(c.created_at).format("DD/MM/YYYY")}<div className="text-xs text-muted-foreground">{dayjs(c.created_at).format("HH:mm")}</div>
    </div> },
    { title: t("code"), width: 130, fixed: "left", render: (_, c) => <span className="font-medium text-primary">{c.code}</span> },
    { title: t("customer"), width: 200, render: (_, c) => <NamePhone phone={c.customer?.phone} name={
      <button type="button" title={t("openProfile")} aria-label={t("openProfile")} className="font-medium hover:text-primary hover:underline"
        onClick={(e) => { e.stopPropagation(); c360.open(c.customer_id); }}>{c.customer?.full_name ?? "—"}</button>} /> },
    { title: t("services"), width: 300, render: (_, c) => {
      // 1 dòng cố định: tối đa MAX_ITEMS dịch vụ, phân cách dấu phẩy (dài thì cắt "…"), dư → "+N" hover xem đủ.
      // Dịch vụ còn hiệu lực lên trước, đã hoàn tiền xuống cuối.
      const items = [...c.items].sort((a, b) => Number(!!a.refunded_at) - Number(!!b.refunded_at));
      const shown = items.slice(0, MAX_ITEMS);
      const rest = items.length - shown.length;
      return <div className="flex min-w-0 gap-1.5">
        <span className="truncate" title={shown.map((i) => serviceName(i.service_id)).join(", ")}>
          {shown.map((i, k) => <Fragment key={i.id}>{k ? ", " : null}{itemText(i)}</Fragment>)}
        </span>
        {rest > 0 ? <Popover content={<div className="flex max-w-80 flex-col gap-1">{items.map(itemText)}</div>}>
          <span className="shrink-0 text-muted-foreground">+{rest}</span>
        </Popover> : null}
      </div>;
    } },
    { title: t("value"), width: 140, align: "right", render: (_, c) => <span className="tabular-nums">{formatRupiah(c.money.value)}</span> },
    { title: t("collected"), width: 140, align: "right", render: (_, c) => <span className="tabular-nums text-success">{formatRupiah(c.money.collected)}</span> },
    { title: t("due"), width: 140, align: "right", render: (_, c) => <DueText due={c.money.due} /> },
    { title: t("createdBy"), width: 170, render: (_, c) => staffName(staff, c.created_by) },
    { title: t("statusLabel"), width: 120, render: (_, c) => <CardStatusTag card={c} tours={cardTours} /> },
  ];

  return <Page>
    <PageHeader title={t("title")} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label={t("statCount")} value={filtered.filter((c) => !c.cancelled_at).length} icon={CreditCard} />
      <StatCard label={t("statValue")} value={formatRupiahCompact(sum((c) => c.money.value))} icon={ReceiptText} iconTone="info" />
      <StatCard label={t("statCollected")} value={formatRupiahCompact(sum((c) => c.money.collected))} icon={HandCoins} iconTone="success" />
      <StatCard label={t("statDue")} value={formatRupiahCompact(sum((c) => Math.max(c.money.due, 0)))} icon={Wallet} iconTone="warning" />
    </div>
    <PageToolbar>
      <SearchInput value={search} placeholder={t("search")} onChange={(v) => { setSearch(v); reset(); }} />
      <DateRangePicker from={dates.from} to={dates.to} onChange={(r) => { setDates(r); reset(); }} placeholder={t("allDates")} />
      <ClearableSelect value={status} ariaLabel={t("statusLabel")} className="min-w-40" placeholder={t("allStatuses")}
        options={STATUSES.map((s) => ({ value: s, label: t(`filter.${s}`) }))} onChange={(v) => { setStatus(v); reset(); }} />
      {/* Select thường (không ClearableSelect): cần tìm theo tên (`title`) — label là avatar + tên. */}
      <Select allowClear value={creator || undefined} aria-label={t("createdBy")} placeholder={t("allCreators")} className="min-w-48"
        showSearch={{ optionFilterProp: "title" }} onChange={(v?: string) => { setCreator(v ?? ""); reset(); }}
        options={creators.map((s) => ({ value: s.id, title: s.user_name, label: staffLabel(s) }))} />
      <ClearFilters show={!!(search || dates.from || status || creator)} onClick={clearFilters} />
    </PageToolbar>
    <DataTable columns={columns} dataSource={filtered} scroll={{ x: 1450 }} empty={t("empty")} page={page} onPageChange={setPage}
      onChange={c360.onTableChange}
      onRow={(c) => ({ onClick: () => setOpenId(c.id), className: "cursor-pointer" })} />
    {open ? <CardDrawer key={open.id} card={open} tours={toursOfCard(open, cardTours)} services={services} staff={staff} me={me}
      onOpenCustomer={c360.open} onClose={() => setOpenId(null)} /> : null}
    {c360.modal}
  </Page>;
}
