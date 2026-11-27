"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, DatePicker, Empty, Segmented, Select, type TableProps } from "antd";
import { CheckCircle2, FileSpreadsheet, PencilLine, Printer, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { claimTour, confirmTour, deleteTour } from "@/app/(app)/tour/actions";
import { DASH } from "@/components/common/cells";
import { ClearableSelect } from "@/components/common/clearable-select";
import { useConfirm } from "@/components/common/confirm-action";
import { DataTable } from "@/components/common/data-table";
import { ClearFilters, SearchInput } from "@/components/common/filter-controls";
import { NamePhone } from "@/components/common/name-phone";
import { RowActions } from "@/components/common/row-actions";
import { StatCard } from "@/components/common/stat-card";
import { staffLabel, staffName, type StaffRef } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { runAction, kindText, TourDrawer, TourStatusTag, type TourMe } from "@/components/tour/tour-drawer";
import { groupByTechnician } from "@/components/tour/tour-data";
import { PhotoCountButton, TourPhotosModal } from "@/components/tour/tour-photos";
import { TourSlips } from "@/components/tour/tour-slips";
import { formatRupiah } from "@/lib/currency";
import { matchesNameOrPhone } from "@/lib/customers";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { toast } from "@/lib/toast";
import { tourCommission, tourStatus, type TourStatus } from "@/lib/tours";
import type { AppointmentCustomer } from "@/types/appointment";
import type { Service } from "@/types/service";
import type { Tour } from "@/types/tour";

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
  return (id: string) => {
    const s = services.find((x) => x.id === id);
    return s ? s.name : "—";
  };
}

// ───────────────────────── KTV ─────────────────────────

/** KTV: điện thoại → danh sách thẻ, PC (≥ sm) → bảng. Lọc khách / dịch vụ (+ trạng thái ở Tour của tôi) dùng chung 2 tab. */
function TechnicianTours({ me, month, tours, pending, services, onOpen, onPhotos, goMonth }: ViewProps) {
  const t = useTranslations("tour");
  const mobile = useIsMobile();
  const serviceLabel = useServiceLabel(services);
  const [tab, setTab] = useState<"pending" | "mine">(pending.length ? "pending" : "mine");
  const [claiming, setClaiming] = useState<string | null>(null);
  const [, start] = useTransition();
  const [search, setSearch] = useState("");
  const [service, setService] = useState("");
  const [status, setStatus] = useState("");
  const source = tab === "pending" ? pending : tours;
  const serviceOptions = [...new Set(source.map((r) => r.service_id))].map((id) => ({ value: id, label: serviceLabel(id) }));
  const shown = source.filter((r) => (!service || r.service_id === service)
    && (tab === "pending" || !status || tourStatus(r) === status)
    && matchesNameOrPhone(r.customer?.full_name ?? "", r.customer?.phone ?? "", search));
  const items = tours;
  const unconfirmed = items.filter((r) => !r.confirmed_at).length;
  // Công Master (Làm mới 7%, Dặm 3%) — phần đã xác nhận là phần được tính lương.
  const total = items.reduce((n, r) => n + tourCommission(r), 0);
  const confirmedTotal = items.reduce((n, r) => n + (r.confirmed_at ? tourCommission(r) : 0), 0);
  const kindCell = (r: Tour) => r.service_detail ? kindText(t, r) : <span className="text-warning">{t("needDetail")}</span>;

  const claim = (id: string) => {
    setClaiming(id);
    start(async () => {
      if (await runAction(claimTour(id), t("claimed"), t("saveError"))) { setTab("mine"); onOpen(id); }
      setClaiming(null);
    });
  };

  const claimButton = (tour: Tour, size: "small" | "large") => me.canEdit
    ? <Button type="primary" size={size} block={size === "large"} loading={claiming === tour.id} disabled={!!claiming}
      onClick={(e) => { e.stopPropagation(); claim(tour.id); }}>{t("claim")}</Button> : null;

  const baseColumns: TableProps<Tour>["columns"] = [
    { title: t("date"), width: 110, render: (_, r) => dayjs(r.tour_date).format("DD/MM/YYYY") },
    { title: t("customer"), width: 200, render: (_, r) => <NamePhone name={r.customer?.full_name ?? "—"} phone={r.customer?.phone} /> },
    { title: t("service"), width: 180, render: (_, r) => serviceLabel(r.service_id) },
    { title: t("kind"), width: 110, render: (_, r) => kindCell(r) },
  ];
  const pendingColumns: TableProps<Tour>["columns"] = [
    ...baseColumns,
    { title: t("note"), render: (_, r) => r.notes.length
      ? <span className="line-clamp-2 whitespace-pre-wrap text-muted-foreground">{r.notes.at(-1)!.text}</span> : DASH },
    ...(me.canEdit ? [{ key: "claim", width: 120, align: "right" as const, render: (_: unknown, r: Tour) => claimButton(r, "small") }] : []),
  ];
  const mineColumns: TableProps<Tour>["columns"] = [
    ...baseColumns,
    { title: t("photos"), width: 90, render: (_, r) => <PhotoCountButton tour={r} onOpen={onPhotos} /> },
    { title: t("commission"), width: 140, align: "right", render: (_, r) => <span className="tabular-nums">{formatRupiah(tourCommission(r))}</span> },
    { title: t("status"), width: 140, render: (_, r) => <TourStatusTag tour={r} /> },
  ];

  return <>
    <PageHeader title={t("title")} />
    {/* Đổi tab → bỏ lọc dịch vụ / trạng thái (DV của tab kia có thể không có ở tab này). */}
    <Segmented block={mobile} value={tab} onChange={(v) => { setTab(v as typeof tab); setService(""); setStatus(""); }} options={[
      { value: "pending", label: `${t("tabPending")} (${pending.length})` },
      { value: "mine", label: t("tabMine") },
    ]} />
    {tab === "mine" ? <>
      {/* Điện thoại: 2 thẻ đếm 1 hàng, "Đã nhận" cả hàng để không cắt số tiền. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatCard label={t("count")} value={items.length} />
        <StatCard label={t("status_claimed")} value={unconfirmed} />
        <div className="col-span-2 sm:col-span-1">
          <StatCard label={t("commission")} value={formatRupiah(total)}
            hint={t("confirmedAmount", { amount: formatRupiah(confirmedTotal) })} />
        </div>
      </div>
    </> : null}
    <PageToolbar>
      {tab === "mine" ? <MonthPicker month={month} goMonth={goMonth} /> : null}
      <SearchInput value={search} placeholder={t("search")} onChange={setSearch} />
      <ClearableSelect className="min-w-44" value={service} ariaLabel={t("service")} placeholder={t("allServices")}
        onChange={setService} options={serviceOptions} />
      {tab === "mine" ? <ClearableSelect className="min-w-40" value={status} ariaLabel={t("status")} placeholder={t("allStatuses")}
        onChange={setStatus} options={(["claimed", "confirmed"] as const).map((s) => ({ value: s, label: t(`status_${s}`) }))} /> : null}
      <ClearFilters show={!!(search || service || status)} onClick={() => { setSearch(""); setService(""); setStatus(""); }} />
    </PageToolbar>
    {!mobile ? <DataTable<Tour> columns={tab === "pending" ? pendingColumns : mineColumns} dataSource={shown} pageSize={50}
      empty={t(tab === "pending" ? "noPending" : "empty")}
      onRow={tab === "mine" ? (r) => ({ onClick: () => onOpen(r.id), className: "cursor-pointer" }) : undefined} />
    : tab === "pending" ? <div className="flex flex-col gap-2">
      {shown.length ? shown.map((tour) => <div key={tour.id} className="surface flex flex-col gap-2 p-3">
        <TourCardBody tour={tour} service={serviceLabel(tour.service_id)} />
        {tour.notes.length ? <p className="line-clamp-3 text-sm whitespace-pre-wrap text-muted-foreground">{tour.notes.at(-1)!.text}</p> : null}
        {claimButton(tour, "large")}
      </div>) : <div className="surface py-10"><Empty description={t("noPending")} /></div>}
    </div> : <div className="flex flex-col gap-2">
      {/* div role=button: thẻ chứa nút ảnh bên trong, không lồng <button>. */}
      {shown.length ? shown.map((tour) => <div key={tour.id} role="button" tabIndex={0} onClick={() => onOpen(tour.id)}
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen(tour.id); } }}
        className="surface flex cursor-pointer flex-col gap-2 p-3 text-left transition-colors hover:border-primary active:bg-muted">
        <TourCardBody tour={tour} service={serviceLabel(tour.service_id)} />
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            {kindCell(tour)}
            <PhotoCountButton tour={tour} onOpen={onPhotos} />
          </span>
          <span className="font-semibold tabular-nums" title={t("commission")}>{formatRupiah(tourCommission(tour))}</span>
        </div>
      </div>) : <div className="surface py-10"><Empty description={t("empty")} /></div>}
    </div>}
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

function TourTable({ me, month, tours, services, staff, onOpen, onPhotos, goMonth }: ViewProps) {
  const t = useTranslations("tour");
  const confirm = useConfirm();
  const serviceLabel = useServiceLabel(services);
  const [status, setStatus] = useState("");
  const [technician, setTechnician] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const technicians = staff.filter((s) => s.department === "technician");

  const all = tours;
  const items = all.filter((r) => (!status || tourStatus(r) === status)
    && (!technician || r.technician_id === technician)
    && matchesNameOrPhone(r.customer?.full_name ?? "", r.customer?.phone ?? "", search));
  // Tour dự kiến (lộ trình tự sinh, chưa chốt lịch) không tính tiền / Excel / phiếu.
  const real = items.filter((r) => !r.planned);
  const groups = me.isAdmin ? groupByTechnician(real, staff) : [];
  const count = (s: TourStatus) => all.filter((r) => tourStatus(r) === s).length;
  const total = real.reduce((n, r) => n + (r.bill_amount ?? 0), 0);
  const commission = real.reduce((n, r) => n + tourCommission(r), 0);
  const failed = t("saveError");

  const exportExcel = async () => {
    setExporting(true);
    try {
      const { downloadTourExcel } = await import("@/components/tour/tour-export");
      await downloadTourExcel(groups, month, {
        technician: t("technician"), date: t("date"), customer: t("customer"), service: t("kind"),
        bill: t("bill"), commission: t("commission"), subtotal: t("subtotal"), total: t("grandTotal"),
        detail: (row) => kindText(t, row),
      });
    } catch {
      toast.error(t("exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  const columns: TableProps<Tour>["columns"] = [
    { title: t("date"), width: 110, render: (_, r) => dayjs(r.tour_date).format("DD/MM/YYYY") },
    { title: t("customer"), width: 200, render: (_, r) => <NamePhone name={r.customer?.full_name ?? "—"} phone={r.customer?.phone} /> },
    { title: t("service"), width: 140, render: (_, r) => serviceLabel(r.service_id) },
    { title: t("kind"), width: 100, render: (_, r) => r.service_detail ? kindText(t, r) : DASH },
    { title: t("technician"), width: 170, render: (_, r) => staffName(staff, r.technician_id) },
    { title: t("photos"), width: 90, render: (_, r) => <PhotoCountButton tour={r} onOpen={onPhotos} /> },
    { title: t("bill"), width: 140, align: "right", render: (_, r) =>
      r.bill_amount == null ? DASH : <span className="tabular-nums">{formatRupiah(r.bill_amount)}</span> },
    { title: t("commission"), width: 120, align: "right", render: (_, r) =>
      r.planned ? DASH : <span className="tabular-nums">{formatRupiah(tourCommission(r))}</span> },
    { title: t("status"), width: 140, render: (_, r) => <TourStatusTag tour={r} /> },
    { key: "actions", width: 56, align: "right", fixed: "right", render: (_, r) => <div onClick={(e) => e.stopPropagation()}>
      <RowActions label={t("actions")} items={[
        { icon: <PencilLine className="size-4" />, label: t("open"), onSelect: () => onOpen(r.id) },
        ...(me.isAdmin && tourStatus(r) === "claimed" ? [{ icon: <CheckCircle2 className="size-4" />, label: t("confirm"),
          onSelect: () => void runAction(confirmTour(r.id, true), t("confirmedToast"), failed) }] : []),
        ...(me.canDelete && !r.planned && (me.isAdmin || (r.created_by === me.id && !r.technician_id)) ? [{
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
    </>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <StatCard label={t("count")} value={all.length - count("planned")} />
      <StatCard label={t("status_planned")} value={count("planned")} />
      <StatCard label={t("status_pending")} value={count("pending")} />
      <StatCard label={t("status_claimed")} value={count("claimed")} />
      <StatCard label={t("bill")} value={formatRupiah(total)} />
      <StatCard label={t("commission")} value={formatRupiah(commission)} />
    </div>
    <PageToolbar>
      <MonthPicker month={month} goMonth={goMonth} />
      <SearchInput value={search} placeholder={t("search")} onChange={setSearch} />
      <ClearableSelect className="min-w-40" value={status} ariaLabel={t("status")} placeholder={t("allStatuses")} onChange={setStatus}
        options={(["planned", "pending", "claimed", "confirmed"] as const).map((s) => ({ value: s, label: t(`status_${s}`) }))} />
      {/* Select thường (không ClearableSelect): cần tìm theo tên (`title`) — label là avatar + tên. */}
      <Select allowClear className="min-w-52" value={technician || undefined} aria-label={t("technician")} placeholder={t("allTechnicians")}
        onChange={(v?: string) => setTechnician(v ?? "")} showSearch={{ optionFilterProp: "title" }}
        options={technicians.map((s) => ({ value: s.id, title: s.user_name, label: staffLabel(s) }))} />
      <ClearFilters show={!!(search || status || technician)} onClick={() => { setSearch(""); setStatus(""); setTechnician(""); }} />
    </PageToolbar>
    <DataTable<Tour> columns={columns} dataSource={items} pageSize={50} empty={t("empty")}
      onRow={(r) => ({ onClick: () => onOpen(r.id), className: "cursor-pointer" })} />
    {me.isAdmin ? <TourSlips groups={groups} month={month} /> : null}
  </>;
}
