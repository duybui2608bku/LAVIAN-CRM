"use client";

import { useState, useTransition } from "react";
import { Button, Form, InputNumber, Radio, Select, Tag } from "antd";
import { CheckCircle2, NotebookPen, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { addTourNote, claimTour, confirmTour, deleteTourNote, releaseTour, updateTour } from "@/app/(app)/tour/actions";
import { ConfirmAction } from "@/components/common/confirm-action";
import { DatePicker } from "@/components/common/date-picker";
import { FormDrawer } from "@/components/common/form-drawer";
import { NoteItem, NotesDrawer } from "@/components/common/notes";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { PhotoField } from "@/components/tour/photo-field";
import { sanitizeCurrencyInput } from "@/lib/currency";
import { toast } from "@/lib/toast";
import { tourDetailFor, tourSessionOf } from "@/lib/cards";
import { MAX_SESSION, PAYMENT_METHODS, tourStatus, type TourStatus } from "@/lib/tours";
import type { AppointmentCustomer } from "@/types/appointment";
import type { Service } from "@/types/service";
import type { Tour, TourImageField, TourPatch } from "@/types/tour";

// canEdit/canDelete = quyền bộ phận tour.edit/tour.delete; quản lý (xác nhận, gán KTV) = isAdmin.
export type TourMe = { id: string; isAdmin: boolean; isTechnician: boolean; canEdit: boolean; canDelete: boolean };
type T = ReturnType<typeof useTranslations<"tour">>;

const STATUS_COLOR: Record<TourStatus, string> = { pending: "gold", claimed: "blue", confirmed: "green" };

export const TourStatusTag = ({ tour }: { tour: Pick<Tour, "technician_id" | "confirmed_at"> }) => {
  const t = useTranslations("tour");
  const status = tourStatus(tour);
  return <Tag color={STATUS_COLOR[status]} className="me-0">{t(`status_${status}`)}</Tag>;
};

/** "Lần n" của tour — dịch vụ chi tiết (New/Retouch/Laser…) suy từ lần, không hiện trên UI (sếp làm lại sau). */
export const sessionText = (t: T, tour: Pick<Tour, "service_detail" | "service_session">) => {
  const n = tourSessionOf(tour);
  return n ? t("sessionN", { n }) : "";
};

/** Gọi server action, hiện toast; trả true khi thành công. */
export async function runAction(action: Promise<{ error?: string }>, success: string, failed: string) {
  try {
    const result = await action;
    if (result.error) { toast.error(result.error); return false; }
    toast.success(success);
    return true;
  } catch {
    toast.error(failed);
    return false;
  }
}

const formatBill = (v: number | string | undefined) => (v === undefined || v === "" ? "" : Number(v).toLocaleString("id-ID"));
const parseBill = (v: string | undefined) => sanitizeCurrencyInput(v ?? "") as unknown as number;
const billInput = <InputNumber<number> className="w-full" min={0} precision={0} controls={false} placeholder="Rp"
  inputMode="numeric" formatter={formatBill} parser={parseBill} />;
/** Nhóm nút chọn kéo giãn hết chiều ngang, các nút chia đều. */
const FULL_GROUP = "flex! w-full flex-wrap gap-y-2";
const FULL_OPTION = "flex-1 text-center whitespace-nowrap";

const customerOptions = (customers: AppointmentCustomer[]) =>
  customers.map((c) => ({ value: c.id, label: [c.full_name, c.phone].filter(Boolean).join(" · ") }));
const serviceOptions = (services: Service[], current?: string) => services
  .filter((s) => s.is_active || s.id === current).map((s) => ({ value: s.id, label: s.name }));

type WorkValues = Pick<TourPatch, "tour_date" | "customer_id" | "service_id" | "technician_id" | "bill_amount" | "payment_method">
  & { session_no?: number | null };

/**
 * Drawer xem/sửa 1 tour — dùng chung cho KTV (nhận, điền chi tiết + ảnh), CSKH và admin (xác nhận).
 * Cha chỉ render khi có tour, `key={tour.id}` để form nạp lại theo tour.
 */
export function TourDrawer({ tour, me, services, staff, customers, onClose }: {
  tour: Tour;
  me: TourMe;
  services: Service[];
  staff: StaffRef[];
  customers: AppointmentCustomer[];
  onClose: () => void;
}) {
  const t = useTranslations("tour");
  const [form] = Form.useForm<WorkValues>();
  const [pending, start] = useTransition();
  const [notesOpen, setNotesOpen] = useState(false);
  const tn = useTranslations("notes");
  // Dịch vụ chi tiết + lần lưu DB suy từ (dịch vụ, Lần).
  const derive = (id: string, n: number | null | undefined) => {
    const service = services.find((s) => s.id === id);
    return n && service ? tourDetailFor(service, n) : null;
  };

  const status = tourStatus(tour);
  const isOwner = tour.technician_id === me.id;
  const canEdit = me.canEdit && (me.isAdmin || (status !== "confirmed" && (!me.isTechnician || isOwner)));
  const canEditBasic = canEdit && !me.isTechnician;
  const fromCard = !!tour.card_item_id; // tour từ thẻ liệu trình: khách + dịch vụ cố định theo thẻ
  const canClaim = me.canEdit && me.isTechnician && status === "pending";
  const technician = staff.find((s) => s.id === tour.technician_id);
  const done = t("saved");
  const failed = t("saveError");

  const save = (confirm?: boolean) => start(async () => {
    let values: WorkValues;
    try { values = await form.validateFields(); } catch { return; }
    const patch: TourPatch = { bill_amount: values.bill_amount ?? null, payment_method: values.payment_method ?? null };
    // Chỉ ghi lại dịch vụ chi tiết khi đổi Lần (tour cũ Debt… giữ nguyên nếu không đụng tới).
    if ((values.session_no ?? null) !== tourSessionOf(tour) || (values.service_id ?? tour.service_id) !== tour.service_id) {
      Object.assign(patch, derive(values.service_id ?? tour.service_id, values.session_no) ?? { service_detail: null, service_session: null });
    }
    if (canEditBasic) Object.assign(patch, fromCard ? { tour_date: values.tour_date }
      : { tour_date: values.tour_date, customer_id: values.customer_id, service_id: values.service_id });
    if (me.isAdmin && (values.technician_id ?? null) !== tour.technician_id) patch.technician_id = values.technician_id ?? null;
    if (canEdit && !(await runAction(updateTour(tour.id, patch), done, failed))) return;
    if (confirm === undefined) { onClose(); return; }
    if (await runAction(confirmTour(tour.id, confirm), confirm ? t("confirmedToast") : t("unconfirmedToast"), failed)) onClose();
  });

  const savePhotos = (field: TourImageField) => (next: string[]) =>
    runAction(updateTour(tour.id, { [field]: next }), t("photoSaved"), failed);

  const footerExtra = <>
    {canClaim ? <Button type="primary" loading={pending} onClick={() => start(async () => {
      await runAction(claimTour(tour.id), t("claimed"), failed);
    })}>{t("claim")}</Button> : null}
    {me.isAdmin && status !== "pending" ? (status === "confirmed"
      ? <Button icon={<Undo2 className="size-4" />} disabled={pending} onClick={() => save(false)}>{t("unconfirm")}</Button>
      : <Button icon={<CheckCircle2 className="size-4" />} disabled={pending} onClick={() => save(true)}>{t("confirm")}</Button>) : null}
    {isOwner && status === "claimed" ? <ConfirmAction title={t("releaseTitle")} okText={t("release")} cancelText={t("cancel")}
      onConfirm={async () => { if (await runAction(releaseTour(tour.id), t("released"), failed)) onClose(); }}>
      <Button danger disabled={pending}>{t("release")}</Button>
    </ConfirmAction> : null}
  </>;

  return <FormDrawer open onClose={onClose} pending={pending} width={520} footerExtra={footerExtra}
    title={<span className="flex items-center gap-2">{tour.customer?.full_name ?? t("title")} <TourStatusTag tour={tour} /></span>}
    submitText={canEdit ? t("save") : t("close")} onSubmit={() => (canEdit ? save() : onClose())}>
    <Form form={form} layout="vertical" requiredMark={false} disabled={!canEdit || pending}
      initialValues={{
        tour_date: tour.tour_date, customer_id: tour.customer_id, service_id: tour.service_id,
        technician_id: tour.technician_id ?? undefined, session_no: tourSessionOf(tour) ?? undefined,
        bill_amount: tour.bill_amount ?? undefined, payment_method: tour.payment_method ?? undefined,
      }}>
      {canEditBasic && !fromCard ? <>
        <div className="grid grid-cols-2 gap-3">
          <Form.Item name="tour_date" label={t("date")} rules={[{ required: true, message: t("required") }]}>
            <DatePicker allowClear={false} />
          </Form.Item>
          <Form.Item name="service_id" label={t("service")} rules={[{ required: true, message: t("required") }]}>
            <Select showSearch={{ optionFilterProp: "label" }} options={serviceOptions(services, tour.service_id)} />
          </Form.Item>
        </div>
        <Form.Item name="customer_id" label={t("customer")} rules={[{ required: true, message: t("required") }]}>
          <Select showSearch={{ optionFilterProp: "label" }} options={customerOptions(customers)} />
        </Form.Item>
      </> : <dl className="mb-4 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">{t("date")}</dt>
        <dd>{canEditBasic ? <Form.Item name="tour_date" noStyle><DatePicker allowClear={false} /></Form.Item>
          : dayjs(tour.tour_date).format("DD/MM/YYYY")}</dd>
        <dt className="text-muted-foreground">{t("customer")}</dt>
        <dd>{tour.customer?.full_name} {tour.customer?.phone ? <a href={`tel:${tour.customer.phone}`} className="text-muted-foreground">· {tour.customer.phone}</a> : null}</dd>
        <dt className="text-muted-foreground">{t("service")}</dt>
        <dd>{(() => { const s = services.find((x) => x.id === tour.service_id); return s ? s.name : "—"; })()}</dd>
        {!me.isAdmin ? <><dt className="text-muted-foreground">{t("technician")}</dt><dd>{technician ? staffLabel(technician) : "—"}</dd></> : null}
      </dl>}

      {me.isAdmin ? <Form.Item name="technician_id" label={t("technician")}>
        <Select allowClear showSearch={{ optionFilterProp: "title" }} placeholder={t("unassigned")}
          options={staff.filter((s) => s.id === tour.technician_id || (s.status === "active" && s.department === "technician"))
            .map((s) => ({ value: s.id, title: s.user_name, label: staffLabel(s) }))} />
      </Form.Item> : null}

      {canClaim ? <p className="mb-4 text-sm text-muted-foreground">{t("claimHint")}</p> : <>
        <div className="grid grid-cols-2 gap-3">
          <Form.Item name="session_no" label={t("session")}>
            <Select allowClear placeholder="—"
              options={Array.from({ length: MAX_SESSION }, (_, i) => ({ value: i + 1, label: t("sessionN", { n: i + 1 }) }))} />
          </Form.Item>
          <Form.Item name="bill_amount" label={t("bill")}>{billInput}</Form.Item>
        </div>
        <Form.Item name="payment_method" label={t("payment")}>
          <Radio.Group optionType="button" className={FULL_GROUP}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`pay_${m}`), className: FULL_OPTION }))} />
        </Form.Item>
      </>}
    </Form>

    {/* Ghi chú tour (timeline): xem nhanh 2 ghi chú mới nhất, thêm / xem hết ở drawer ghi chú chung. */}
    <section className="mb-4">
      <div className="mb-2">{t("note")}</div>
      {tour.notes.length ? <div className="mb-3 space-y-3">
        {tour.notes.slice(-2).reverse().map((n) => <NoteItem key={n.id} note={n} staff={staff} clamp />)}
      </div> : null}
      <Button block icon={<NotebookPen className="size-4" />} onClick={() => setNotesOpen(true)}>
        {tn("viewAll", { count: tour.notes.length })}
      </Button>
    </section>
    <NotesDrawer open={notesOpen} staff={staff} notes={tour.notes} onClose={() => setNotesOpen(false)}
      title={[t("note"), tour.customer?.full_name].filter(Boolean).join(" · ")}
      onAdd={canEdit ? (input) => addTourNote(tour.id, input) : undefined}
      canDelete={(n) => canEdit && n.by_id === me.id}
      onDelete={(n) => n.id ? deleteTourNote(tour.id, n.id) : Promise.resolve({})} />

    {status !== "pending" ? <div className="flex flex-col gap-4">
      <PhotoField label={t("beforePhotos")} capture value={tour.before_images} disabled={!canEdit} onChange={savePhotos("before_images")} />
      <PhotoField label={t("afterPhotos")} capture value={tour.after_images} disabled={!canEdit} onChange={savePhotos("after_images")} />
      <PhotoField label={t("extraPhotos")} value={tour.extra_images} disabled={!canEdit} onChange={savePhotos("extra_images")} />
    </div> : null}
  </FormDrawer>;
}
