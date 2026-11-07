"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, DatePicker, Empty, Input, Segmented, Select, Tag, type TableProps } from "antd";
import { CheckCircle2, FileSpreadsheet, PencilLine, Plus, Printer, Search, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dayjs from "dayjs";
import { claimTour, confirmTour, deleteTour } from "@/app/(app)/tour/actions";
import { useConfirm } from "@/components/common/confirm-action";
import { DataTable } from "@/components/common/data-table";
import { RowActions } from "@/components/common/row-actions";
import { StatCard } from "@/components/common/stat-card";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { CreateTourDrawer, detailText, runAction, TourDrawer, TourStatusTag, type TourMe } from "@/components/tour/tour-drawer";
import { groupByTechnician, toItem, type TourItem } from "@/components/tour/tour-data";
import { PhotoCountButton, TourPhotosModal } from "@/components/tour/tour-photos";
import { TourSlips } from "@/components/tour/tour-slips";
import { formatRupiah } from "@/lib/currency";
import { serviceName } from "@/lib/customers";
import { toast } from "@/lib/toast";
import { tourStatus, type TourStatus } from "@/lib/tours";
import type { AppointmentCustomer } from "@/types/appointment";
import type { Service } from "@/types/service";
import type { Tour } from "@/types/tour";

const DASH = <span className="text-muted-foreground">—</span>;
const ALL = "all";

type Props = {
  me: TourMe;
  month: string;
  tours: Tour[];
  pending: Tour[];
  services: Service[];
  staff: StaffRef[];
  customers: AppointmentCustomer[];
};

/** Menu Tour: KTV → danh sách thẻ (điện thoại); CSKH/admin → bảng. Bấm tour mở drawer chi tiết. */
export function TourView(props: Props) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [photosId, setPhotosId] = useState<string | null>(null);
  const find = (id: string | null) => (id ? [...props.pending, ...props.tours].find((t) => t.id === id) : undefined);
  const open = find(openId);
  const goMonth = (month: string) => router.push(`/tour?month=${month}`);
  const shared = { ...props, onOpen: setOpenId, onPhotos: setPhotosId, goMonth };

  return <Page>
    {props.me.isTechnician ? <TechnicianTours {...shared} /> : <TourTable {...shared} />}
    {open ? <TourDrawer key={open.id} tour={open} me={props.me} services={props.services} staff={props.staff}
      customers={props.customers} onClose={() => setOpenId(null)} /> : null}
    <TourPhotosModal tour={find(photosId)} onClose={() => setPhotosId(null)} />
  </Page>;
}

type ViewProps = Props & { onOpen: (id: string) => void; onPhotos: (id: string) => void; goMonth: (month: string) => void };

function MonthPicker({ month, goMonth }: { month: string; goMonth: (m: string) => void }) {
  const t = useTranslations("tour");
  return <DatePicker picker="month" value={dayjs(`${month}-01`)} allowClear={false} format="MM/YYYY"
    aria-label={t("month")} inputReadOnly onChange={(d) => d && goMonth(d.format("YYYY-MM"))} />;
}

function useServiceLabel(services: Service[]) {
  const locale = useLocale();
  return (id: string) => {
    const s = services.find((x) => x.id === id);
    return s ? serviceName(s, locale) : "—";
  };
}

// ───────────────────────── KTV ─────────────────────────

function TechnicianTours({ month, tours, pending, services, onOpen, onPhotos, goMonth }: ViewProps) {
  const t = useTranslations("tour");
  const serviceLabel = useServiceLabel(services);
  const [tab, setTab] = useState<"pending" | "mine">(pending.length ? "pending" : "mine");
  const [claiming, setClaiming] = useState<string | null>(null);
  const [, start] = useTransition();
  const items = tours.map(toItem);
  const unconfirmed = items.filter((r) => !r.confirmed_at).length;
  const total = items.reduce((n, r) => n + (r.amount ?? 0), 0);
  const confirmedTotal = items.reduce((n, r) => n + (r.confirmed_at ? r.amount ?? 0 : 0), 0);

  const claim = (id: string) => {
    setClaiming(id);
    start(async () => {
      if (await runAction(claimTour(id), t("claimed"), t("saveError"))) { setTab("mine"); onOpen(id); }
      setClaiming(null);
    });
  };

  return <>
    <PageHeader title={t("title")} />
    <Segmented block value={tab} onChange={(v) => setTab(v as typeof tab)} options={[
      { value: "pending", label: `${t("tabPending")} (${pending.length})` },
      { value: "mine", label: t("tabMine") },
    ]} />
    {tab === "pending" ? <div className="flex flex-col gap-2">
      {pending.length ? pending.map((tour) => <div key={tour.id} className="surface flex flex-col gap-2 p-3">
        <TourCardBody tour={tour} service={serviceLabel(tour.service_id)} />
        {tour.note ? <p className="line-clamp-3 text-sm text-muted-foreground">{tour.note}</p> : null}
        <Button type="primary" size="large" block loading={claiming === tour.id} disabled={!!claiming}
          onClick={() => claim(tour.id)}>{t("claim")}</Button>
      </div>) : <div className="surface py-10"><Empty description={t("noPending")} /></div>}
    </div> : <>
      <PageToolbar><MonthPicker month={month} goMonth={goMonth} /></PageToolbar>
      {/* Điện thoại: 2 thẻ đếm 1 hàng, "Đã nhận" cả hàng để không cắt số tiền. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatCard label={t("count")} value={items.length} />
        <StatCard label={t("status_claimed")} value={unconfirmed} />
        <div className="col-span-2 sm:col-span-1">
          <StatCard label={t("received")} value={formatRupiah(total)}
            hint={t("confirmedAmount", { amount: formatRupiah(confirmedTotal) })} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {/* div role=button: thẻ chứa nút ảnh bên trong, không lồng <button>. */}
        {items.length ? items.map((tour) => <div key={tour.id} role="button" tabIndex={0} onClick={() => onOpen(tour.id)}
          onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen(tour.id); } }}
          className="surface flex cursor-pointer flex-col gap-2 p-3 text-left transition-colors hover:border-primary active:bg-muted">
          <TourCardBody tour={tour} service={serviceLabel(tour.service_id)} />
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              {tour.service_detail ? <Tag color="cyan" className="me-0">{detailText(t, tour)}</Tag> : <Tag className="me-0">{t("needDetail")}</Tag>}
              <PhotoCountButton tour={tour} onOpen={onPhotos} />
            </span>
            <span className="font-semibold tabular-nums">{tour.amount == null ? "—" : formatRupiah(tour.amount)}</span>
          </div>
        </div>) : <div className="surface py-10"><Empty description={t("empty")} /></div>}
      </div>
    </>}
  </>;
}

function TourCardBody({ tour, service }: { tour: Tour; service: string }) {
  return <>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate font-medium">{tour.customer?.full_name ?? "—"}</p>
        <p className="text-sm text-muted-foreground">{dayjs(tour.tour_date).format("DD/MM/YYYY")} · {service}</p>
      </div>
      <TourStatusTag tour={tour} />
    </div>
  </>;
}

// ───────────────────────── CSKH / admin ─────────────────────────

function TourTable({ me, month, tours, services, staff, customers, onOpen, onPhotos, goMonth }: ViewProps) {
  const t = useTranslations("tour");
  const confirm = useConfirm();
  const serviceLabel = useServiceLabel(services);
  const [status, setStatus] = useState<TourStatus | typeof ALL>(ALL);
  const [technician, setTechnician] = useState(ALL);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const technicians = staff.filter((s) => s.department === "technician");

  const all = tours.map(toItem);
  const q = search.trim().toLocaleLowerCase();
  const items = all.filter((r) => (status === ALL || tourStatus(r) === status)
    && (technician === ALL || r.technician_id === technician)
    && (!q || `${r.customer?.full_name ?? ""} ${r.customer?.phone ?? ""}`.toLocaleLowerCase().includes(q)));
  const groups = me.isAdmin ? groupByTechnician(items, staff) : [];
  const count = (s: TourStatus) => all.filter((r) => tourStatus(r) === s).length;
  const total = items.reduce((n, r) => n + (r.amount ?? 0), 0);
  const failed = t("saveError");

  const exportExcel = async () => {
    setExporting(true);
    try {
      const { downloadTourExcel } = await import("@/components/tour/tour-export");
      await downloadTourExcel(groups, month, {
        technician: t("technician"), date: t("date"), customer: t("customer"), service: t("serviceDetail"),
        bill: t("bill"), rate: "%", tour: t("received"), subtotal: t("subtotal"), total: t("grandTotal"),
        detail: (row) => detailText(t, row),
      });
    } catch {
      toast.error(t("exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  const columns: TableProps<TourItem>["columns"] = [
    { title: t("date"), width: 110, render: (_, r) => dayjs(r.tour_date).format("DD/MM/YYYY") },
    { title: t("customer"), width: 200, render: (_, r) => <div className="min-w-0">
      <p className="font-medium">{r.customer?.full_name ?? "—"}</p>
      <p className="text-xs text-muted-foreground">{r.customer?.phone}</p>
    </div> },
    { title: t("service"), width: 140, render: (_, r) => serviceLabel(r.service_id) },
    { title: t("serviceDetail"), width: 130, render: (_, r) => r.service_detail
      ? <Tag color="cyan" className="me-0">{detailText(t, r)}</Tag> : DASH },
    { title: t("technician"), width: 170, render: (_, r) => {
      const s = r.technician_id ? staffById.get(r.technician_id) : undefined;
      return s ? staffLabel(s) : DASH;
    } },
    { title: t("photos"), width: 90, render: (_, r) => <PhotoCountButton tour={r} onOpen={onPhotos} /> },
    { title: t("bill"), width: 140, align: "right", render: (_, r) =>
      r.bill_amount == null ? DASH : <span className="tabular-nums">{formatRupiah(r.bill_amount)}</span> },
    { title: t("payment"), width: 120, render: (_, r) => r.payment_method ? t(`pay_${r.payment_method}`) : DASH },
    { title: "%", width: 60, align: "right", render: (_, r) => r.rate == null ? DASH : `${Math.round(r.rate * 100)}%` },
    { title: t("received"), width: 140, align: "right", render: (_, r) =>
      r.amount == null ? DASH : <span className="tabular-nums font-semibold">{formatRupiah(r.amount)}</span> },
    { title: t("status"), width: 140, render: (_, r) => <TourStatusTag tour={r} /> },
    { key: "actions", width: 56, align: "right", fixed: "right", render: (_, r) => <div onClick={(e) => e.stopPropagation()}>
      <RowActions label={t("actions")} items={[
        { icon: <PencilLine className="size-4" />, label: t("open"), onSelect: () => onOpen(r.id) },
        ...(me.isAdmin && tourStatus(r) === "claimed" ? [{ icon: <CheckCircle2 className="size-4" />, label: t("confirm"),
          onSelect: () => void runAction(confirmTour(r.id, true), t("confirmedToast"), failed) }] : []),
        ...(me.isAdmin || (r.created_by === me.id && !r.technician_id) ? [{
          icon: <Trash2 className="size-4" />, label: t("remove"), danger: true, onSelect: () => confirm({
            title: t("removeTitle"), content: t("removeBody", { name: r.customer?.full_name ?? "" }),
            okText: t("remove"), cancelText: t("cancel"),
            onOk: () => runAction(deleteTour(r.id), t("removed"), failed),
          }),
        }] : []),
      ]} />
    </div> },
  ];

  return <>
    <PageHeader title={t("title")} actions={<>
      {me.isAdmin ? <>
        <Button icon={<FileSpreadsheet className="size-4" />} loading={exporting} disabled={!groups.length} onClick={exportExcel}>
          {t("exportExcel")}
        </Button>
        <Button icon={<Printer className="size-4" />} disabled={!groups.length} onClick={() => window.print()}>
          {t("exportSlip")}
        </Button>
      </> : null}
      <Button type="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>{t("create")}</Button>
    </>} />
    <PageToolbar>
      <MonthPicker month={month} goMonth={goMonth} />
      <Input value={search} allowClear className="w-full sm:max-w-60" placeholder={t("search")} aria-label={t("search")}
        prefix={<Search className="size-4" />} onChange={(e) => setSearch(e.target.value)} />
      <Select className="min-w-40" value={status} aria-label={t("status")} onChange={setStatus} options={[
        { value: ALL, label: t("allStatuses") },
        ...(["pending", "claimed", "confirmed"] as const).map((s) => ({ value: s, label: t(`status_${s}`) })),
      ]} />
      <Select className="min-w-52" value={technician} aria-label={t("technician")} onChange={setTechnician}
        showSearch={{ optionFilterProp: "title" }} options={[
          { value: ALL, title: t("allTechnicians"), label: t("allTechnicians") },
          ...technicians.map((s) => ({ value: s.id, title: s.user_name, label: staffLabel(s) })),
        ]} />
    </PageToolbar>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label={t("count")} value={all.length} />
      <StatCard label={t("status_pending")} value={count("pending")} />
      <StatCard label={t("status_claimed")} value={count("claimed")} />
      <StatCard label={t("received")} value={formatRupiah(total)} />
    </div>
    <DataTable<TourItem> columns={columns} dataSource={items} pageSize={50} empty={t("empty")}
      onRow={(r) => ({ onClick: () => onOpen(r.id), className: "cursor-pointer" })} />
    <CreateTourDrawer open={creating} onClose={() => setCreating(false)} services={services} customers={customers} />
    {me.isAdmin ? <TourSlips groups={groups} month={month} /> : null}
  </>;
}
