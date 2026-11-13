"use client";

import { useTransition } from "react";
import { Button, Form, Input, InputNumber, Radio, Select, Tag } from "antd";
import { CheckCircle2, Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dayjs from "dayjs";
import { claimTour, confirmTour, createTour, releaseTour, updateTour } from "@/app/(app)/tour/actions";
import { ConfirmAction } from "@/components/common/confirm-action";
import { DatePicker } from "@/components/common/date-picker";
import { FormDrawer } from "@/components/common/form-drawer";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { PhotoField } from "@/components/tour/photo-field";
import { formatRupiah, sanitizeCurrencyInput } from "@/lib/currency";
import { serviceName } from "@/lib/customers";
import { toast } from "@/lib/toast";
import {
  MAX_SESSION, needsSession, PAYMENT_METHODS, SERVICE_DETAILS, tourAmount, tourRate, tourStatus,
  type ServiceDetail, type TourStatus,
} from "@/lib/tours";
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

export const detailText = (t: T, tour: Pick<Tour, "service_detail" | "service_session">) =>
  tour.service_detail ? `${t(`detail_${tour.service_detail}`)}${tour.service_session ? ` ${tour.service_session}` : ""}` : "";

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
  customers.map((c) => ({ value: c.id, label: `${c.full_name} · ${c.phone}` }));
const serviceOptions = (services: Service[], locale: string, current?: string) => services
  .filter((s) => s.is_active || s.id === current).map((s) => ({ value: s.id, label: serviceName(s, locale) }));

type WorkValues = Pick<TourPatch, "tour_date" | "customer_id" | "service_id" | "technician_id" | "service_detail"
  | "service_session" | "bill_amount" | "payment_method" | "note">;

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
  const locale = useLocale();
  const [form] = Form.useForm<WorkValues>();
  const [pending, start] = useTransition();
  const detail = Form.useWatch("service_detail", form) as ServiceDetail | null | undefined;
  const session = Form.useWatch("service_session", form) as number | null | undefined;
  const bill = Form.useWatch("bill_amount", form) as number | null | undefined;

  const status = tourStatus(tour);
  const isOwner = tour.technician_id === me.id;
  const canEdit = me.canEdit && (me.isAdmin || (status !== "confirmed" && (!me.isTechnician || isOwner)));
  const canEditBasic = canEdit && !me.isTechnician;
  const canClaim = me.canEdit && me.isTechnician && status === "pending";
  const technician = staff.find((s) => s.id === tour.technician_id);
  const done = t("saved");
  const failed = t("saveError");

  const save = (confirm?: boolean) => start(async () => {
    let values: WorkValues;
    try { values = await form.validateFields(); } catch { return; }
    const patch: TourPatch = {
      service_detail: values.service_detail ?? null,
      service_session: needsSession(values.service_detail) ? values.service_session ?? null : null,
      bill_amount: values.bill_amount ?? null,
      payment_method: values.payment_method ?? null,
      note: values.note ?? "",
    };
    if (canEditBasic) Object.assign(patch, { tour_date: values.tour_date, customer_id: values.customer_id, service_id: values.service_id });
    if (me.isAdmin && (values.technician_id ?? null) !== tour.technician_id) patch.technician_id = values.technician_id ?? null;
    if (canEdit && !(await runAction(updateTour(tour.id, patch), done, failed))) return;
    if (confirm === undefined) { onClose(); return; }
    if (await runAction(confirmTour(tour.id, confirm), confirm ? t("confirmedToast") : t("unconfirmedToast"), failed)) onClose();
  });

  const savePhotos = (field: TourImageField) => (next: string[]) =>
    runAction(updateTour(tour.id, { [field]: next }), t("photoSaved"), failed);

  const amount = detail ? tourAmount(detail, session ?? null, bill ?? null) : null;

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
        technician_id: tour.technician_id ?? undefined, service_detail: tour.service_detail ?? undefined,
        service_session: tour.service_session ?? undefined, bill_amount: tour.bill_amount ?? undefined,
        payment_method: tour.payment_method ?? undefined, note: tour.note,
      }}
      onValuesChange={(changed: WorkValues) => {
        if (!("service_detail" in changed)) return;
        const next = changed.service_detail;
        form.setFieldValue("service_session", needsSession(next) ? form.getFieldValue("service_session") ?? 1 : undefined);
      }}>
      {canEditBasic ? <>
        <div className="grid grid-cols-2 gap-3">
          <Form.Item name="tour_date" label={t("date")} rules={[{ required: true, message: t("required") }]}>
            <DatePicker allowClear={false} />
          </Form.Item>
          <Form.Item name="service_id" label={t("service")} rules={[{ required: true, message: t("required") }]}>
            <Select showSearch={{ optionFilterProp: "label" }} options={serviceOptions(services, locale, tour.service_id)} />
          </Form.Item>
        </div>
        <Form.Item name="customer_id" label={t("customer")} rules={[{ required: true, message: t("required") }]}>
          <Select showSearch={{ optionFilterProp: "label" }} options={customerOptions(customers)} />
        </Form.Item>
      </> : <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">{t("date")}</dt><dd>{dayjs(tour.tour_date).format("DD/MM/YYYY")}</dd>
        <dt className="text-muted-foreground">{t("customer")}</dt>
        <dd>{tour.customer?.full_name} {tour.customer?.phone ? <a href={`tel:${tour.customer.phone}`} className="text-muted-foreground">· {tour.customer.phone}</a> : null}</dd>
        <dt className="text-muted-foreground">{t("service")}</dt>
        <dd>{(() => { const s = services.find((x) => x.id === tour.service_id); return s ? serviceName(s, locale) : "—"; })()}</dd>
        {!me.isAdmin ? <><dt className="text-muted-foreground">{t("technician")}</dt><dd>{technician ? staffLabel(technician) : "—"}</dd></> : null}
      </dl>}

      {me.isAdmin ? <Form.Item name="technician_id" label={t("technician")}>
        <Select allowClear showSearch={{ optionFilterProp: "title" }} placeholder={t("unassigned")}
          options={staff.filter((s) => s.id === tour.technician_id || (s.status === "active" && s.department === "technician"))
            .map((s) => ({ value: s.id, title: s.user_name, label: staffLabel(s) }))} />
      </Form.Item> : null}

      {canClaim ? <p className="mb-4 text-sm text-muted-foreground">{t("claimHint")}</p> : <>
        <Form.Item name="service_detail" label={t("serviceDetail")}>
          <Radio.Group optionType="button" buttonStyle="solid" className={FULL_GROUP}
            options={SERVICE_DETAILS.map((d) => ({ value: d, label: t(`detail_${d}`), className: FULL_OPTION }))} />
        </Form.Item>
        <div className="grid grid-cols-2 gap-3">
          <Form.Item name="service_session" label={t("session")}
            rules={[{ required: needsSession(detail), message: t("required") }]}>
            <Select disabled={!needsSession(detail) || !canEdit} placeholder="—"
              options={Array.from({ length: MAX_SESSION }, (_, i) => ({ value: i + 1, label: t("sessionN", { n: i + 1 }) }))} />
          </Form.Item>
          <Form.Item label={t("rate")}>
            <div className="flex h-8 items-center tabular-nums">
              {detail && (!needsSession(detail) || session) ? `${Math.round(tourRate(detail, session ?? null) * 100)}%` : "—"}
            </div>
          </Form.Item>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Form.Item name="bill_amount" label={t("bill")}>{billInput}</Form.Item>
          <Form.Item label={t("received")}>
            <div className="flex h-8 items-center font-semibold tabular-nums">{amount == null ? "—" : formatRupiah(amount)}</div>
          </Form.Item>
        </div>
        <Form.Item name="payment_method" label={t("payment")}>
          <Radio.Group optionType="button" className={FULL_GROUP}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`pay_${m}`), className: FULL_OPTION }))} />
        </Form.Item>
      </>}

      <Form.Item name="note" label={t("note")}>
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={10000} />
      </Form.Item>
    </Form>

    {status !== "pending" ? <div className="flex flex-col gap-4">
      <PhotoField label={t("beforePhotos")} capture value={tour.before_images} disabled={!canEdit} onChange={savePhotos("before_images")} />
      <PhotoField label={t("afterPhotos")} capture value={tour.after_images} disabled={!canEdit} onChange={savePhotos("after_images")} />
      <PhotoField label={t("extraPhotos")} value={tour.extra_images} disabled={!canEdit} onChange={savePhotos("extra_images")} />
    </div> : null}
  </FormDrawer>;
}

type CreateValues = { tour_date: string; customer_id: string; service_id: string; bill_amount?: number | null; note?: string };

/** CSKH tạo tour cơ bản: ngày, khách, dịch vụ, ghi chú → vào danh sách chờ nhận của KTV. */
export function CreateTourDrawer({ open, onClose, services, customers }: {
  open: boolean;
  onClose: () => void;
  services: Service[];
  customers: AppointmentCustomer[];
}) {
  const t = useTranslations("tour");
  const locale = useLocale();
  const [form] = Form.useForm<CreateValues>();
  const [pending, start] = useTransition();

  const onFinish = (values: CreateValues) => start(async () => {
    if (await runAction(createTour({ ...values, note: values.note ?? "" }), t("created"), t("saveError"))) onClose();
  });

  return <FormDrawer open={open} onClose={onClose} title={t("create")} submitText={t("create")}
    pending={pending} onSubmit={() => form.submit()}>
    <Form form={form} layout="vertical" requiredMark={false} disabled={pending} onFinish={onFinish}
      initialValues={{ tour_date: dayjs().format("YYYY-MM-DD") }}>
      <Form.Item name="tour_date" label={t("date")} rules={[{ required: true, message: t("required") }]}>
        <DatePicker allowClear={false} />
      </Form.Item>
      <Form.Item name="customer_id" label={t("customer")} rules={[{ required: true, message: t("required") }]}>
        <Select showSearch={{ optionFilterProp: "label" }} placeholder={t("chooseCustomer")} options={customerOptions(customers)} />
      </Form.Item>
      <Form.Item name="service_id" label={t("service")} rules={[{ required: true, message: t("required") }]}>
        <Select showSearch={{ optionFilterProp: "label" }} placeholder={t("chooseService")} options={serviceOptions(services, locale)} />
      </Form.Item>
      <Form.Item name="bill_amount" label={t("bill")}>{billInput}</Form.Item>
      <Form.Item name="note" label={t("note")} className="mb-0">
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={10000} />
      </Form.Item>
    </Form>
  </FormDrawer>;
}
