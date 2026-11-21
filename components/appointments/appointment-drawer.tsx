"use client";

import { useTransition } from "react";
import { Button, Divider, Form, InputNumber, Select, Tag } from "antd";
import { NotebookPen, PanelRightOpen, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { patchAppointment } from "@/app/(app)/appointments/actions";
import { setAppointmentPerformers } from "@/app/(app)/customers/customer-360-actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { staffOptions, type AppointmentStaff } from "@/components/appointments/appointments-manager";
import { NoteItem } from "@/components/common/notes";
import { FormDrawer } from "@/components/common/form-drawer";
import { staffLabel } from "@/components/common/user-avatar";
import { appointmentMoney } from "@/lib/appointments";
import { sanitizeCurrencyInput } from "@/lib/currency";
import { toast } from "@/lib/toast";
import {
  BOOKING_STATUS_COLORS, VISIT_STATUSES,
  type Appointment, type AppointmentCustomer, type AppointmentPatch, type VisitStatus,
} from "@/types/appointment";
import { PERFORMER_ROLES, type AppointmentPerformer } from "@/types/customer-360";
import type { Service } from "@/types/service";
import { useServiceGroups } from "@/components/common/service-groups";

const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const moneyInput = <InputNumber<number> className="w-full" min={0} precision={0} controls={false} placeholder="0"
  inputMode="numeric" formatter={(v) => (v == null || `${v}` === "" ? "" : Number(v).toLocaleString("id-ID"))}
  parser={(v) => sanitizeCurrencyInput(v ?? "") as unknown as number} />;

// Trường drawer sửa được — gửi lên server chỉ những trường đã đổi.
const FIELDS = ["scheduled_at", "visit_status", "service_categories", "service_ids", "paid_amount", "bill_amount",
  "sales_id", "technician_id"] as const satisfies readonly (keyof AppointmentPatch)[];
type Values = Pick<Appointment, (typeof FIELDS)[number]> & { performers: Partial<AppointmentPerformer>[] };
// Vai trò theo bộ phận: Sales → "sales"; Master (technician) → Mapping / Phun-xăm / Hỗ trợ.
const rolesOf = (department: string | null | undefined) =>
  PERFORMER_ROLES.filter((r) => (department === "sales" ? r === "sales" : r !== "sales"));

type Props = {
  appointment: Appointment;
  customer: AppointmentCustomer | undefined;
  staff: AppointmentStaff[];
  services: Service[];
  canEdit: boolean;
  /** Status được chọn (Sales/admin: tất cả; Master: chỉ Đã thực hiện; rỗng = không đổi được). */
  visitChoices: VisitStatus[];
  onViewInfo: (customer: AppointmentCustomer) => void;
  onOpenNotes: () => void;
  onClose: () => void;
};

/** Drawer sửa 1 lịch hẹn ở Sales Management (bấm tên khách) — theo mẫu của sếp. */
export function AppointmentDrawer({ appointment, ...props }: Omit<Props, "appointment"> & { appointment: Appointment | null }) {
  // key theo lịch → mỗi lần mở là form mới (không giữ giá trị của lịch trước).
  return appointment ? <AppointmentDrawerBody key={appointment.id} appointment={appointment} {...props} /> : null;
}

function AppointmentDrawerBody({ appointment: a, customer, staff, services, canEdit, visitChoices, onViewInfo, onOpenNotes, onClose }: Props) {
  const t = useTranslations("appointments");
  const tn = useTranslations("notes");
  const groups = useServiceGroups();
  const [form] = Form.useForm<Values>();
  const [pending, start] = useTransition();
  const cats = Form.useWatch("service_categories", form) ?? [];
  const paid = Form.useWatch("paid_amount", form) ?? 0;
  const bill = Form.useWatch("bill_amount", form) ?? 0;

  const deposit = customer?.deposit_amount ?? 0;
  const money = appointmentMoney(bill, deposit, paid);
  const nameOf = (id: string) => {
    const s = services.find((x) => x.id === id);
    return s ? s.name : id;
  };
  // Dòng phụ đầu drawer: SĐT · Nhóm DV – DV chi tiết · Xác nhận lịch.
  const serviceLine = [
    groups.label(a.service_categories),
    a.service_ids.map(nameOf).join(", "),
  ].filter(Boolean).join(" – ");
  const tele = a.staff_id ? staff.find((s) => s.id === a.staff_id) : undefined;

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
    onSubmit={canEdit ? () => form.submit() : onClose}
    title={<div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="truncate text-lg font-semibold">{customer?.full_name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-normal text-muted-foreground tabular-nums">
          {[customer?.phone, serviceLine].filter(Boolean).join(" · ")}
          <Tag color={BOOKING_STATUS_COLORS[a.booking_confirm]} className="me-0">{t(`bookingStatus.${a.booking_confirm}`)}</Tag>
        </div>
      </div>
      {customer && <Button type="text" size="small" aria-label={t("viewInfo")} title={t("viewInfo")}
        icon={<PanelRightOpen className="size-4" />} onClick={() => onViewInfo(customer)} />}
    </div>}>
    <Form form={form} layout="vertical" disabled={!canEdit || pending} onFinish={submit} requiredMark={false}
      initialValues={{ ...Object.fromEntries(FIELDS.map((f) => [f, a[f]])), performers: a.performers ?? [] }}>
      <h3 className="mb-3 font-semibold">{t("sectionBooking")}</h3>
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

      <Divider className="mt-1 mb-4" />
      <h3 className="mb-3 font-semibold">{t("sectionService")}</h3>
      <div className="grid grid-cols-2 gap-x-4 max-sm:grid-cols-1">
        <Form.Item name="service_categories" label={t("serviceCategories")}>
          <Select mode="multiple" allowClear placeholder={t("choose")} options={groups.options} />
        </Form.Item>
        {/* DV chi tiết: chỉ dịch vụ thuộc nhóm đã chọn (chưa chọn nhóm → tất cả); dịch vụ đang gán luôn hiện. */}
        <Form.Item name="service_ids" label={t("serviceDetails")}>
          <Select mode="multiple" allowClear placeholder={t("choose")} showSearch={{ optionFilterProp: "label" }}
            options={services.filter((s) => a.service_ids.includes(s.id)
              || (s.is_active && (!cats.length || cats.includes(s.group_id))))
              .map((s) => ({ value: s.id, label: s.name }))} />
        </Form.Item>
      </div>
      {/* Thực thu = Deposit (của khách) + Thu thêm; Phải thu = Giá trị DV − Thực thu (không âm). */}
      <div className="mb-4 rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold">{t("financeCard")}</span>
          <span className="text-xs text-muted-foreground">IDR</span>
        </div>
        <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm tabular-nums">
          <dt className="text-muted-foreground">{t("deposit")}</dt><dd className="text-right">{idr.format(deposit)}</dd>
          <dt className="text-muted-foreground">{t("bill")}</dt><dd className="text-right">{idr.format(bill)}</dd>
          <dt className="text-muted-foreground">{t("paidTotal")}</dt><dd className="text-right text-success">{idr.format(money.collected)}</dd>
          {/* E2: đã có cọc mà chưa chốt giá → Phải thu chưa xác định. */}
          <dt className="font-medium">{t("due")}</dt><dd className="text-right font-medium text-warning">
            {!bill && deposit > 0 ? t("dueUnknown") : idr.format(money.due)}
          </dd>
        </dl>
        <Divider className="my-4" />
        <Form.Item name="paid_amount" label={t("paidInput")}>{moneyInput}</Form.Item>
        {/* E3: Giá trị DV (> 0) không nhỏ hơn số đã thu. */}
        <Form.Item name="bill_amount" label={t("billInput")} className="mb-0" dependencies={["paid_amount"]} rules={[{
          validator: (_, v?: number | null) => v && v < deposit + (form.getFieldValue("paid_amount") ?? 0)
            ? Promise.reject(new Error(t("rule.billBelowCollected"))) : Promise.resolve(),
        }]}>{moneyInput}</Form.Item>
      </div>

      <Divider className="mt-1 mb-4" />
      <h3 className="mb-3 font-semibold">{t("sectionStaff")}</h3>
      {/* Telesales · Sales · Master cùng 1 hàng (điện thoại: xếp dọc). */}
      <div className="grid grid-cols-3 gap-x-4 max-sm:grid-cols-1">
        <Form.Item label={t("staff")}>
          <span className={tele ? undefined : "text-muted-foreground"}>{tele ? staffLabel(tele) : "—"}</span>
        </Form.Item>
        <Form.Item name="sales_id" label={t("sales")}>
          <Select allowClear showSearch={{ optionFilterProp: "label" }} placeholder={t("choose")}
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
          <Select allowClear showSearch={{ optionFilterProp: "label" }} placeholder={t("unassigned")}
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
              <Select showSearch={{ optionFilterProp: "label" }} placeholder={t("performer")} aria-label={t("performer")}
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

      <Divider className="mt-1 mb-4" />
      {/* Ghi chú Sales: xem nhanh 2 ghi chú mới nhất, thêm / xem hết ở drawer Ghi chú Sales. */}
      <h3 className="mb-3 font-semibold">{t("sectionNote")}</h3>
      {a.sales_notes.length ? <div className="mb-3 space-y-3">
        {a.sales_notes.slice(-2).reverse().map((n) => <NoteItem key={n.id} note={n} staff={staff} clamp />)}
      </div> : <p className="mb-3 text-muted-foreground">{tn("empty")}</p>}
      <Button block icon={<NotebookPen className="size-4" />} disabled={false} onClick={onOpenNotes}>
        {tn("viewAll", { count: a.sales_notes.length })}
      </Button>
    </Form>
  </FormDrawer>;
}
