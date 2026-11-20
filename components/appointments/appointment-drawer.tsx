"use client";

import { useTransition } from "react";
import { Button, Divider, Form, InputNumber, Select, Tag } from "antd";
import { NotebookPen, PanelRightOpen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { patchAppointment } from "@/app/(app)/appointments/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { staffOptions, type AppointmentStaff } from "@/components/appointments/appointments-manager";
import { NoteItem } from "@/components/common/notes";
import { FormDrawer } from "@/components/common/form-drawer";
import { staffLabel } from "@/components/common/user-avatar";
import { appointmentMoney } from "@/lib/appointments";
import { sanitizeCurrencyInput } from "@/lib/currency";
import { serviceName } from "@/lib/customers";
import { toast } from "@/lib/toast";
import {
  BOOKING_STATUS_COLORS, VISIT_STATUSES,
  type Appointment, type AppointmentCustomer, type AppointmentPatch,
} from "@/types/appointment";
import { SERVICE_CATEGORY_LABELS, SERVICE_CATEGORY_OPTIONS, type Service, type ServiceCategory } from "@/types/service";

const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const moneyInput = <InputNumber<number> className="w-full" min={0} precision={0} controls={false} placeholder="0"
  inputMode="numeric" formatter={(v) => (v == null || `${v}` === "" ? "" : Number(v).toLocaleString("id-ID"))}
  parser={(v) => sanitizeCurrencyInput(v ?? "") as unknown as number} />;

// Trường drawer sửa được — gửi lên server chỉ những trường đã đổi.
const FIELDS = ["scheduled_at", "visit_status", "service_categories", "service_ids", "paid_amount", "bill_amount",
  "sales_id", "technician_id"] as const satisfies readonly (keyof AppointmentPatch)[];
type Values = Pick<Appointment, (typeof FIELDS)[number]>;

type Props = {
  appointment: Appointment;
  customer: AppointmentCustomer | undefined;
  staff: AppointmentStaff[];
  services: Service[];
  canEdit: boolean;
  canShowUp: boolean;
  onViewInfo: (customer: AppointmentCustomer) => void;
  onOpenNotes: () => void;
  onClose: () => void;
};

/** Drawer sửa 1 lịch hẹn ở Sales Management (bấm tên khách) — theo mẫu của sếp. */
export function AppointmentDrawer({ appointment, ...props }: Omit<Props, "appointment"> & { appointment: Appointment | null }) {
  // key theo lịch → mỗi lần mở là form mới (không giữ giá trị của lịch trước).
  return appointment ? <AppointmentDrawerBody key={appointment.id} appointment={appointment} {...props} /> : null;
}

function AppointmentDrawerBody({ appointment: a, customer, staff, services, canEdit, canShowUp, onViewInfo, onOpenNotes, onClose }: Props) {
  const t = useTranslations("appointments");
  const tn = useTranslations("notes");
  const locale = useLocale();
  const [form] = Form.useForm<Values>();
  const [pending, start] = useTransition();
  const cats = Form.useWatch("service_categories", form) ?? [];
  const paid = Form.useWatch("paid_amount", form) ?? 0;
  const bill = Form.useWatch("bill_amount", form) ?? 0;

  const deposit = customer?.deposit_amount ?? 0;
  const money = appointmentMoney(bill, deposit, paid);
  const nameOf = (id: string) => {
    const s = services.find((x) => x.id === id);
    return s ? serviceName(s, locale) : id;
  };
  // Dòng phụ đầu drawer: SĐT · Nhóm DV – DV chi tiết · Xác nhận lịch.
  const serviceLine = [
    a.service_categories.map((c) => SERVICE_CATEGORY_LABELS[c] ?? c).join(", "),
    a.service_ids.map(nameOf).join(", "),
  ].filter(Boolean).join(" – ");
  const tele = a.staff_id ? staff.find((s) => s.id === a.staff_id) : undefined;

  const submit = (values: Values) => {
    const patch = Object.fromEntries(FIELDS
      .map((f) => [f, values[f] ?? null] as const)
      .filter(([f, v]) => JSON.stringify(v) !== JSON.stringify(a[f] ?? null))) as AppointmentPatch;
    if (!Object.keys(patch).length) return onClose();
    start(async () => {
      try {
        const result = await patchAppointment(a.id, patch);
        if (result.error) toast.error(result.error);
        else { toast.success(t("saved")); onClose(); }
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
      initialValues={Object.fromEntries(FIELDS.map((f) => [f, a[f]]))}>
      <h3 className="mb-3 font-semibold">{t("sectionBooking")}</h3>
      <div className="grid grid-cols-2 gap-x-4 max-sm:grid-cols-1">
        <Form.Item name="scheduled_at" label={t("date")} trigger="onSave" rules={[{ required: true, message: t("chooseDate") }]}>
          <AppointmentDate className="w-full" onSave={() => {}} />
        </Form.Item>
        {/* Status chỉ Sales/admin đổi. */}
        <Form.Item name="visit_status" label={t("confirmation")}>
          <Select disabled={!canShowUp} options={VISIT_STATUSES.map((value) => ({ value, label: t(`visitStatus.${value}`) }))} />
        </Form.Item>
      </div>

      <Divider className="mt-1 mb-4" />
      <h3 className="mb-3 font-semibold">{t("sectionService")}</h3>
      <div className="grid grid-cols-2 gap-x-4 max-sm:grid-cols-1">
        <Form.Item name="service_categories" label={t("serviceCategories")}>
          <Select mode="multiple" allowClear placeholder={t("choose")} options={SERVICE_CATEGORY_OPTIONS} />
        </Form.Item>
        {/* DV chi tiết: chỉ dịch vụ thuộc nhóm đã chọn (chưa chọn nhóm → tất cả); dịch vụ đang gán luôn hiện. */}
        <Form.Item name="service_ids" label={t("serviceDetails")}>
          <Select mode="multiple" allowClear placeholder={t("choose")} showSearch={{ optionFilterProp: "label" }}
            options={services.filter((s) => a.service_ids.includes(s.id)
              || (s.is_active && (!cats.length || cats.includes(s.category as ServiceCategory))))
              .map((s) => ({ value: s.id, label: serviceName(s, locale) }))} />
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
          <dt className="font-medium">{t("due")}</dt><dd className="text-right font-medium text-warning">{idr.format(money.due)}</dd>
        </dl>
        <Divider className="my-4" />
        <Form.Item name="paid_amount" label={t("paidInput")}>{moneyInput}</Form.Item>
        <Form.Item name="bill_amount" label={t("billInput")} className="mb-0">{moneyInput}</Form.Item>
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
        <Form.Item name="technician_id" label={t("master")}>
          <Select allowClear showSearch={{ optionFilterProp: "label" }} placeholder={t("unassigned")}
            options={staffOptions(staff, a.technician_id, ["technician"])} />
        </Form.Item>
      </div>

      <Divider className="mt-1 mb-4" />
      {/* Ghi chú Sales: xem nhanh 2 ghi chú mới nhất, thêm / xem hết ở drawer Ghi chú Sales. */}
      <h3 className="mb-3 font-semibold">{t("sectionNote")}</h3>
      {a.sales_notes.length ? <div className="mb-3 space-y-3">
        {a.sales_notes.slice(-2).reverse().map((n) => <NoteItem key={n.id} note={n} staff={staff} clamp />)}
      </div> : <p className="mb-3 text-muted-foreground">{tn("empty")}</p>}
      <Button block icon={<NotebookPen className="size-4" />} disabled={false} onClick={onOpenNotes}>
        {t("notesAll", { count: a.sales_notes.length })}
      </Button>
    </Form>
  </FormDrawer>;
}
