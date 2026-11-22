"use client";

import { useState, useTransition } from "react";
import { Button, Form, Select } from "antd";
import { CheckCircle2, NotebookPen, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { addTourNote, claimTour, confirmTour, deleteTourNote, releaseTour, updateTour } from "@/app/(app)/tour/actions";
import { StatusDot } from "@/components/common/cells";
import { ConfirmAction } from "@/components/common/confirm-action";
import { DatePicker } from "@/components/common/date-picker";
import { FormDrawer } from "@/components/common/form-drawer";
import { NoteItem, NotesDrawer } from "@/components/common/notes";
import { Section } from "@/components/common/section";
import { staffName, staffOptions, type StaffRef } from "@/components/common/user-avatar";
import { PhotoField } from "@/components/tour/photo-field";
import { formatRupiah } from "@/lib/currency";
import { toast } from "@/lib/toast";
import { TOUR_KINDS } from "@/lib/cards";
import { tourCommission, tourStatus, type TourStatus } from "@/lib/tours";
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
  return <StatusDot color={STATUS_COLOR[status]} label={t(`status_${status}`)} />;
};

/** "Lần n" của tour — dịch vụ chi tiết (New/Retouch/Laser…) suy từ lần, không hiện trên UI (sếp làm lại sau). */
/** Nhãn Loại tour: "Laser 2", "Làm mới", "Dặm 1" (Debt cũ không số); chưa có → "". */
export const kindText = (t: T, tour: Pick<Tour, "service_detail" | "service_session">) =>
  tour.service_detail ? [t(`detail_${tour.service_detail}`), tour.service_session].filter(Boolean).join(" ") : "";

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

const customerOptions = (customers: AppointmentCustomer[]) =>
  customers.map((c) => ({ value: c.id, label: [c.full_name, c.phone].filter(Boolean).join(" · ") }));
const serviceOptions = (services: Service[], current?: string) => services
  .filter((s) => s.is_active || s.id === current).map((s) => ({ value: s.id, label: s.name }));

type WorkValues = Pick<TourPatch, "tour_date" | "customer_id" | "service_id" | "technician_id">
  & { kind?: string | null };

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
  const status = tourStatus(tour);
  const isOwner = tour.technician_id === me.id;
  const canEdit = me.canEdit && (me.isAdmin || (status !== "confirmed" && (!me.isTechnician || isOwner)));
  const canEditBasic = canEdit && !me.isTechnician;
  const fromCard = !!tour.card_item_id; // tour từ thẻ liệu trình: khách + dịch vụ cố định theo thẻ
  const canClaim = me.canEdit && me.isTechnician && status === "pending";
  const done = t("saved");
  const failed = t("saveError");

  const save = (confirm?: boolean) => start(async () => {
    let values: WorkValues;
    try { values = await form.validateFields(); } catch { return; }
    const patch: TourPatch = {};
    // Đổi Loại → server tính lại số lần (tour cũ Debt giữ nguyên nếu không đụng tới).
    if (values.kind && values.kind !== tour.service_detail) patch.kind = values.kind as TourPatch["kind"];
    if (canEditBasic) Object.assign(patch, fromCard ? { tour_date: values.tour_date }
      : { tour_date: values.tour_date, customer_id: values.customer_id, service_id: values.service_id });
    if (me.isAdmin && (values.technician_id ?? null) !== tour.technician_id) patch.technician_id = values.technician_id ?? null;
    // Không đổi gì (vd. Master chỉ mở rồi lưu) → bỏ qua, schema không nhận patch rỗng.
    if (canEdit && Object.keys(patch).length && !(await runAction(updateTour(tour.id, patch), done, failed))) return;
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
    submitText={t("save")} onSubmit={canEdit ? () => save() : undefined}>
    <Form form={form} layout="vertical" requiredMark={false} disabled={!canEdit || pending}
      initialValues={{
        tour_date: tour.tour_date, customer_id: tour.customer_id, service_id: tour.service_id,
        technician_id: tour.technician_id ?? undefined, kind: tour.service_detail ?? undefined,
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
        {!me.isAdmin ? <><dt className="text-muted-foreground">{t("technician")}</dt><dd>{staffName(staff, tour.technician_id)}</dd></> : null}
      </dl>}

      {me.isAdmin ? <Form.Item name="technician_id" label={t("technician")}>
        <Select allowClear showSearch={{ optionFilterProp: "title" }} placeholder={t("unassigned")}
          options={staffOptions(staff, tour.technician_id, ["technician"])} />
      </Form.Item> : null}

      {canClaim ? null : <div className="grid grid-cols-2 gap-3">
        <Form.Item name="kind" label={t("kind")}>
          <Select placeholder="—"
            options={[...TOUR_KINDS, ...(tour.service_detail === "debt" ? ["debt"] : [])]
              .map((k) => ({ value: k, label: t(`detail_${k}`), disabled: k === "debt" }))} />
        </Form.Item>
        {/* Hoá đơn chỉ xem (giá bán lấy từ thẻ khi tạo tour) — thanh toán thu ở thẻ liệu trình. */}
        <Form.Item label={t("bill")}>
          <span className="tabular-nums">{tour.bill_amount == null ? "—" : formatRupiah(tour.bill_amount)}</span>
          <div className="text-xs text-muted-foreground tabular-nums">{t("commission")}: {formatRupiah(tourCommission(tour))}</div>
        </Form.Item>
      </div>}
    </Form>

    {/* Ghi chú tour (timeline): xem nhanh 2 ghi chú mới nhất, thêm / xem hết ở drawer ghi chú chung. */}
    <Section title={t("note")} className="mb-4">
      {tour.notes.length ? <div className="space-y-3">
        {tour.notes.slice(-2).reverse().map((n) => <NoteItem key={n.id} note={n} staff={staff} clamp />)}
      </div> : null}
      <Button block icon={<NotebookPen className="size-4" />} onClick={() => setNotesOpen(true)}>
        {tn("viewAll", { count: tour.notes.length })}
      </Button>
    </Section>
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
