"use client";

import { useTransition } from "react";
import { Button, Empty, Form, Select } from "antd";
import { ChevronRight, NotebookPen, PanelRightOpen, Plus, ShoppingCart, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { patchAppointment } from "@/app/(app)/appointments/actions";
import { setAppointmentPerformers } from "@/app/(app)/customers/customer-360-actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { type AppointmentStaff } from "@/components/appointments/appointments-manager";
import { CardStatusTag, DueText, usageOf } from "@/components/cards/card-drawer";
import { cardMoney, isTourable } from "@/lib/cards";
import { confirmStatus, isArrived } from "@/lib/kpi";
import { formatRupiah } from "@/lib/currency";
import { StatusTag } from "@/components/common/cells";
import { NoteItem } from "@/components/common/notes";
import { FormDrawer } from "@/components/common/form-drawer";
import { Section } from "@/components/common/section";
import { useServiceGroups } from "@/components/common/service-groups";
import { staffName, staffOptions } from "@/components/common/user-avatar";
import { toast } from "@/lib/toast";
import {
  BOOKING_STATUS_COLORS, VISIT_STATUSES, type Appointment, type AppointmentCustomer, type AppointmentPatch, type VisitStatus,
} from "@/types/appointment";
import { PERFORMER_ROLES, type AppointmentPerformer } from "@/types/customer-360";
import type { TreatmentCard } from "@/types/card";
import type { Service } from "@/types/service";
import type { Tour } from "@/types/tour";

// Trường drawer sửa được — gửi lên server chỉ những trường đã đổi. Dịch vụ / tiền nằm ở thẻ liệu trình (cột Thẻ trên bảng).
const FIELDS = ["scheduled_at", "visit_status", "sales_id", "technician_id"] as const satisfies readonly (keyof AppointmentPatch)[];
type Values = Pick<Appointment, (typeof FIELDS)[number]> & { performers: Partial<AppointmentPerformer>[] };
// Vai trò theo bộ phận: Sales → "sales"; Master (technician) → Mapping / Phun-xăm / Hỗ trợ.
const rolesOf = (department: string | null | undefined) =>
  PERFORMER_ROLES.filter((r) => (department === "sales" ? r === "sales" : r !== "sales"));

type Props = {
  appointment: Appointment;
  customer: AppointmentCustomer | undefined;
  staff: AppointmentStaff[];
  canEdit: boolean;
  /** Status được chọn (Sales/admin: tất cả; Master: chỉ Đã thực hiện; rỗng = không đổi được). */
  visitChoices: VisitStatus[];
  /** Thẻ liệu trình bán ở lịch này (chưa huỷ). */
  card: TreatmentCard | undefined;
  /** Tour của thẻ (đếm buổi đã dùng). */
  cardTours: Tour[];
  services: Service[];
  /** Cọc chưa trừ vào thẻ nào của khách (hiện khi lịch chưa có thẻ). */
  deposit: number;
  /** Mở drawer thẻ (chồng lên drawer này) — mọi chỗ sửa thẻ nằm ở đó. */
  onOpenCard: (cardId: string) => void;
  /** Bán thẻ cho lịch này; không truyền = không có quyền bán. */
  onSellCard?: () => void;
  onViewInfo: (customer: AppointmentCustomer) => void;
  onOpenNotes: () => void;
  onClose: () => void;
};

/** Drawer sửa 1 lịch hẹn ở Sales Management (bấm tên khách) — theo mẫu của sếp. */
export function AppointmentDrawer({ appointment, ...props }: Omit<Props, "appointment"> & { appointment: Appointment | null }) {
  // key theo lịch → mỗi lần mở là form mới (không giữ giá trị của lịch trước).
  return appointment ? <AppointmentDrawerBody key={appointment.id} appointment={appointment} {...props} /> : null;
}

function AppointmentDrawerBody({
  appointment: a, customer, staff, canEdit, visitChoices, card, cardTours, services, deposit, onOpenCard, onSellCard, onViewInfo, onOpenNotes, onClose,
}: Props) {
  const t = useTranslations("appointments");
  const tn = useTranslations("notes");
  const [form] = Form.useForm<Values>();
  const [pending, start] = useTransition();
  const submit = (values: Values) => {
    const patch = Object.fromEntries(FIELDS
      .map((f) => [f, values[f] ?? null] as const)
      .filter(([f, v]) => JSON.stringify(v) !== JSON.stringify(a[f] ?? null))) as AppointmentPatch;
    const performers = (values.performers ?? []).filter((p): p is AppointmentPerformer => !!p?.profile_id && !!p.role)
      .map(({ profile_id, role }) => ({ profile_id, role }));
    const performersChanged = JSON.stringify(performers) !== JSON.stringify(a.performers ?? []);
    if (!Object.keys(patch).length && !performersChanged) return onClose();
    start(async () => {
      try {
        const result = Object.keys(patch).length ? await patchAppointment(a.id, patch) : {};
        if (result.error) return void toast.error(result.error);
        const saved = performersChanged ? await setAppointmentPerformers(a.id, performers) : {};
        if (saved.error) return void toast.error(saved.error);
        toast.success(t("saved")); onClose();
      } catch { toast.error(t("saveError")); }
    });
  };

  return <FormDrawer open onClose={onClose} pending={pending} width={560} submitText={t("saveUpdate")}
    onSubmit={canEdit ? () => form.submit() : undefined}
    title={<div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate">{customer?.full_name}</span>
        <StatusTag color={BOOKING_STATUS_COLORS[confirmStatus(a)]} label={t(`bookingStatus.${confirmStatus(a)}`)} className="font-normal" />
      </span>
      {customer && <Button type="text" size="small" aria-label={t("viewInfo")} title={t("viewInfo")}
        icon={<PanelRightOpen className="size-4" />} onClick={() => onViewInfo(customer)} />}
    </div>}>
    <Form form={form} layout="vertical" disabled={!canEdit || pending} onFinish={submit} requiredMark={false}
      initialValues={{ ...Object.fromEntries(FIELDS.map((f) => [f, a[f]])), performers: a.performers ?? [] }}>
      <Section title={t("sectionBooking")}>
        <div className="grid grid-cols-2 gap-x-4 max-sm:grid-cols-1">
          <Form.Item name="scheduled_at" label={t("date")} trigger="onSave" rules={[{ required: true, message: t("chooseDate") }]}>
            <AppointmentDate className="w-full" onSave={() => {}} />
          </Form.Item>
          {/* Status: Sales/admin đổi mọi trạng thái; Master chỉ chọn được Đã thực hiện. */}
          <Form.Item name="visit_status" label={t("confirmation")}>
            <Select disabled={!visitChoices.length} options={VISIT_STATUSES.map((value) => ({
              value, label: t(`visitStatus.${value}`), disabled: value !== a.visit_status && !visitChoices.includes(value),
            }))} />
          </Form.Item>
        </div>
      </Section>

      {/* Thẻ liệu trình: chỉ xem — thu tiền / tour / hoàn đều ở drawer thẻ (nút Mở thẻ). */}
      <Section title={t("sectionCard")} className="mb-6">
        {card ? <CardSummary card={card} tours={cardTours} services={services} onOpen={() => onOpenCard(card.id)} />
          : <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3">
            <div>
              <div className="text-xs text-muted-foreground">{t("deposit")}</div>
              <div className="font-medium tabular-nums">{formatRupiah(deposit)}</div>
            </div>
            {onSellCard ? <Button icon={<ShoppingCart className="size-4" />} disabled={!isArrived(a.visit_status)}
              title={isArrived(a.visit_status) ? undefined : t("sellCardNeedsArrival")} onClick={onSellCard}>{t("sellCard")}</Button> : null}
          </div>}
      </Section>

      <Section title={t("sectionStaff")}>
        {/* Telesales · Sales · Master cùng 1 hàng (điện thoại: xếp dọc). */}
        <div className="grid grid-cols-3 gap-x-4 max-sm:grid-cols-1">
          <Form.Item label={t("staff")}>
            {staffName(staff, a.staff_id)}
          </Form.Item>
          <Form.Item name="sales_id" label={t("sales")}>
            <Select allowClear showSearch={{ optionFilterProp: "title" }} placeholder={t("choose")}
              options={staffOptions(staff, a.sales_id, ["sales"])} />
          </Form.Item>
          {/* E3: Đã thực hiện cần Master; Đang thực hiện cần Master hoặc Sales. */}
          <Form.Item name="technician_id" label={t("master")} dependencies={["visit_status", "sales_id"]} rules={[{
            validator: (_, v?: string | null) => {
              const status = form.getFieldValue("visit_status");
              if (!v && status === "done") return Promise.reject(new Error(t("rule.doneNeedsMaster")));
              if (!v && status === "in_progress" && !form.getFieldValue("sales_id")) return Promise.reject(new Error(t("rule.inProgressNeedsStaff")));
              return Promise.resolve();
            },
          }]}>
            <Select allowClear showSearch={{ optionFilterProp: "title" }} placeholder={t("unassigned")}
              options={staffOptions(staff, a.technician_id, ["technician"])} />
          </Form.Item>
        </div>

        {/* Người thực hiện thêm (ngoài Master): mỗi người 1 vai trò, mỗi người tối đa 1 lần. */}
        <div className="mb-4">
          <div className="mb-2 text-sm">{t("performers")}</div>
          <Form.List name="performers">{(fields, { add, remove }) => <div className="flex flex-col gap-2">
            {fields.map((field) => <div key={field.key} className="flex items-start gap-2">
              <Form.Item name={[field.name, "profile_id"]} className="mb-0 min-w-0 flex-1" rules={[
                { required: true, message: t("performer") },
                { validator: (_, v?: string) => v && (form.getFieldValue("performers") as Partial<AppointmentPerformer>[])
                  .filter((p) => p?.profile_id === v).length > 1 ? Promise.reject(new Error(t("performerDuplicate"))) : Promise.resolve() },
              ]}>
                <Select showSearch={{ optionFilterProp: "title" }} placeholder={t("performer")} aria-label={t("performer")}
                  options={staffOptions(staff, a.performers?.[field.name]?.profile_id, ["technician", "sales"])}
                  // Đổi người → chọn sẵn vai trò hợp bộ phận.
                  onChange={(id: string) => form.setFieldValue(["performers", field.name, "role"],
                    rolesOf(staff.find((s) => s.id === id)?.department)[0])} />
              </Form.Item>
              <Form.Item noStyle shouldUpdate>{() => {
                const person = staff.find((s) => s.id === form.getFieldValue(["performers", field.name, "profile_id"]));
                return <Form.Item name={[field.name, "role"]} className="mb-0 w-36" rules={[{ required: true, message: t("performerRole") }]}>
                  <Select placeholder={t("performerRole")} aria-label={t("performerRole")}
                    options={rolesOf(person?.department).map((r) => ({ value: r, label: t(`performerRoles.${r}`) }))} />
                </Form.Item>;
              }}</Form.Item>
              <Button type="text" aria-label={tn("delete")} icon={<X className="size-4" />} onClick={() => remove(field.name)} />
            </div>)}
            <Button type="dashed" icon={<Plus className="size-4" />} onClick={() => add({})} className="self-start">{t("addPerformer")}</Button>
          </div>}</Form.List>
        </div>
      </Section>

      {/* Ghi chú Sales: xem nhanh 2 ghi chú mới nhất, thêm / xem hết ở drawer Ghi chú Sales. */}
      <Section title={t("sectionNote")}>
        {a.sales_notes.length ? <div className="space-y-3">
          {a.sales_notes.slice(-2).reverse().map((n) => <NoteItem key={n.id} note={n} staff={staff} clamp />)}
        </div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tn("empty")} />}
        <Button block icon={<NotebookPen className="size-4" />} disabled={false} onClick={onOpenNotes}>
          {tn("viewAll", { count: a.sales_notes.length })}
        </Button>
      </Section>
    </Form>
  </FormDrawer>;
}

/** Tóm tắt thẻ: mã + trạng thái, dịch vụ (đã dùng x/y buổi), 3 số tiền ở đáy khung. */
function CardSummary({ card, tours, services, onOpen }: { card: TreatmentCard; tours: Tour[]; services: Service[]; onOpen: () => void }) {
  const t = useTranslations("appointments");
  const tc = useTranslations("cards");
  const groups = useServiceGroups();
  const m = cardMoney(card);
  const used = usageOf(tours);
  const money: [string, React.ReactNode][] = [
    [tc("value"), formatRupiah(m.value)],
    [tc("collected"), <span key="c" className="text-success">{formatRupiah(m.collected)}</span>],
    [m.due < 0 ? tc("refundOwed") : tc("due"), <DueText key="d" due={m.due} />],
  ];
  return <div className="overflow-hidden rounded-lg border border-border">
    <div className="flex items-center justify-between gap-3 py-2 ps-4 pe-2">
      <span className="flex min-w-0 items-center gap-2">
        <span className="font-semibold">{card.code}</span>
        <CardStatusTag card={card} tours={tours} />
      </span>
      {/* disabled={false}: vẫn mở được thẻ khi form chỉ xem. */}
      <Button type="link" size="small" disabled={false} icon={<ChevronRight className="size-4" />} iconPlacement="end" onClick={onOpen}>
        {t("openCard")}
      </Button>
    </div>
    <ul className="divide-y divide-border border-t border-border">
      {card.items.map((item) => {
        const s = services.find((x) => x.id === item.service_id);
        const n = used(item.id);
        return <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <div className={item.refunded_at ? "truncate text-sm line-through opacity-60" : "truncate text-sm font-medium"}>{s?.name ?? "—"}</div>
            <div className="text-xs text-muted-foreground tabular-nums">{s ? `${groups.name(s.group_id)} · ` : ""}{formatRupiah(item.price)}</div>
          </div>
          {item.refunded_at ? <span className="shrink-0 text-xs text-destructive">{tc("status.refunded")}</span>
            // Mực / phí Master: không tạo tour → không có buổi.
            : isTourable(item) ? <span className={`shrink-0 text-sm tabular-nums ${n >= item.sessions ? "text-success" : "text-muted-foreground"}`}>
              {tc("usedSessions", { used: n, total: item.sessions })}
            </span> : null}
        </li>;
      })}
    </ul>
    <dl className="grid grid-cols-3 gap-3 border-t border-border bg-muted/50 px-4 py-3 tabular-nums max-sm:grid-cols-1">
      {money.map(([label, value]) => <div key={label} className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 truncate font-medium">{value}</dd>
      </div>)}
    </dl>
  </div>;
}
