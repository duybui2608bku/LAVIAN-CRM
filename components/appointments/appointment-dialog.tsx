"use client";

import { useTransition } from "react";
import { Button, Drawer, Form, Input, InputNumber, Tag } from "antd";
import { useLocale, useTranslations } from "next-intl";
import { Wallet } from "lucide-react";

import {
  createAppointment,
  updateAppointment,
} from "@/app/(app)/appointments/actions";
import { ledgerPaid, paidTotal } from "@/lib/appointments";
import { formatRupiah } from "@/lib/currency";
import { optionLabel, serviceName } from "@/lib/customers";
import { formatISODate } from "@/lib/date";
import { toast } from "@/lib/toast";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { ClearableSelect } from "@/components/common/clearable-select";
import { CurrencyInput } from "@/components/common/currency-input";
import { DatePicker, TimePicker } from "@/components/common/date-picker";
import type {
  Appointment,
  AppointmentInput,
  PaymentMethod,
  ServiceLedger,
} from "@/types/appointment";
import { PAYMENT_METHODS } from "@/types/appointment";
import type { EnumOption } from "@/types/customer";
import type { Service } from "@/types/service";

// source/technician_id/service_ids: thông tin ban đầu của khách để prefill khi tạo
// lịch mới (optional — /customers truyền full Customer nên tự khớp).
export type CustomerRef = {
  id: string;
  full_name: string;
  phone: string;
  source?: string | null;
  technician_id?: string | null;
  service_ids?: string[];
};

type Values = {
  customer_id: string;
  scheduled_date?: string; // "" = chờ xếp lịch
  scheduled_time?: string;
  duration_minutes?: number | null;
  technician_id?: string;
  source?: string;
  total_amount?: string; // tổng giá liệu trình — ghi vào SỔ chung
  deposit_amount?: string; // chỉ dùng khi TẠO — thành dòng sổ deposit
  payment_method?: string;
  booking_note?: string;
  internal_note?: string;
  service_id: string; // bắt buộc đúng 1 dịch vụ
};

const localTime = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * Dialog tạo/sửa lịch hẹn — dùng ở /appointments và /customers (nút Đặt lịch).
 * `customerLock`: mở từ /customers thì khóa cứng khách, không hiện select.
 */
export function AppointmentDialog({
  open,
  editing,
  customerLock,
  customers,
  staff,
  options,
  services,
  appointments = [],
  returningIds,
  onClose,
  onOpenPayments,
}: {
  open: boolean;
  editing: Appointment | null;
  customerLock?: CustomerRef | null;
  customers: CustomerRef[];
  staff: StaffRef[];
  options: EnumOption[];
  services: Service[];
  /** Toàn bộ lịch hẹn đã nạp — để tra SỔ MỞ của (khách, dịch vụ) khi tạo mới. */
  appointments?: Appointment[];
  /** id các khách đã có lịch hẹn từ trước — hiện badge "Khách cũ". */
  returningIds?: Set<string>;
  onClose: () => void;
  /** Mở dialog Thanh toán của lịch đang sửa (chỉ /appointments truyền). */
  onOpenPayments?: (id: string) => void;
}) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const [form] = Form.useForm<Values>();
  const [pending, start] = useTransition();

  // Prefill thông tin ban đầu của khách (nguồn/dịch vụ/kỹ thuật viên) CHỈ khi tạo
  // mới — sửa lịch giữ nguyên dữ liệu của chính lịch hẹn.
  const lock = editing ? null : customerLock;

  // Sổ MỞ của (khách, dịch vụ) trong data đã nạp — nguồn chân lý là server
  // (resolveLedger); đây chỉ để prefill Tổng giá + báo "sổ hiện có".
  const openLedger = (
    customerId: string,
    serviceId: string,
  ): ServiceLedger | null =>
    appointments
      .map((a) => a.ledger)
      .find(
        (l) =>
          l &&
          l.customer_id === customerId &&
          l.service_id === serviceId &&
          !l.closed_at,
      ) ?? null;

  const initialServiceId =
    editing?.service_ids?.[0] ?? lock?.service_ids?.[0] ?? "";
  const lockLedger = lock ? openLedger(lock.id, initialServiceId) : null;

  const initialValues: Values = {
    customer_id: editing?.customer_id ?? customerLock?.id ?? "",
    scheduled_date: editing?.scheduled_at
      ? formatISODate(new Date(editing.scheduled_at))
      : "",
    scheduled_time: editing?.scheduled_at ? localTime(editing.scheduled_at) : "09:00",
    duration_minutes: editing?.duration_minutes ?? 60,
    technician_id: editing?.technician_id ?? lock?.technician_id ?? "",
    source: editing?.source ?? lock?.source ?? "",
    total_amount:
      (editing ? editing.ledger?.total_amount : lockLedger?.total_amount)?.toString() ?? "",
    deposit_amount: "0",
    payment_method: editing?.payment_method ?? "",
    booking_note: editing?.booking_note ?? "",
    internal_note: editing?.internal_note ?? "",
    service_id: initialServiceId,
  };

  // Sổ đang khớp lựa chọn hiện tại (để hiện "Sổ hiện có — đã thu X").
  const wCustomerId = Form.useWatch("customer_id", form) ?? initialValues.customer_id;
  const wServiceId = Form.useWatch("service_id", form) ?? initialValues.service_id;
  const liveLedger = editing ? editing.ledger : openLedger(wCustomerId, wServiceId);

  // Đổi khách/dịch vụ khi TẠO MỚI → nạp Tổng giá theo sổ mở của cặp mới
  // (không có sổ → để trống, tránh mang giá của cặp cũ sang).
  const syncTotalFromLedger = (customerId: string, serviceId: string) => {
    if (editing) return;
    const l = openLedger(customerId, serviceId);
    form.setFieldValue("total_amount", l?.total_amount?.toString() ?? "");
  };

  // Tạo mới: nạp thông tin ban đầu theo khách vừa chọn
  // (khách chưa có → để trống, không giữ của khách trước).
  const onCustomerChange = (id: string) => {
    const c = customers.find((x) => x.id === id);
    if (editing || !c) return;
    const svc = (c.service_ids ?? []).find((sid) => serviceOpts.some((o) => o.value === sid));
    form.setFieldsValue({
      source: c.source ?? "",
      technician_id: c.technician_id ?? "",
      service_id: svc ?? "",
    });
    syncTotalFromLedger(id, svc ?? "");
  };

  // Option nguồn: active + giá trị hiện tại (kể cả inactive) — pattern customers.
  const sourceOptions = options
    .filter((o) => o.kind === "source" && (o.is_active || o.value === editing?.source))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((o) => ({ value: o.value, label: optionLabel(o, locale) }));
  // Bao luôn dịch vụ inactive đang gắn (của lịch đang sửa / khách prefill).
  const presetServiceIds = editing?.service_ids ?? lock?.service_ids ?? [];
  const serviceOpts = services
    .filter((s) => s.is_active || presetServiceIds.includes(s.id))
    .map((s) => ({ value: s.id, label: serviceName(s, locale) }));
  const isReturning = (id: string) => !!id && !!returningIds?.has(id);
  const currentTechnicianId = editing?.technician_id ?? lock?.technician_id ?? null;
  const technicianOptions = staff
    .filter(
      (s) =>
        (s.department === "technician" && s.status === "active") ||
        s.id === currentTechnicianId,
    )
    .map((s) => ({ value: s.id, label: staffLabel(s) }));
  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: `${c.full_name} — ${c.phone}`,
  }));
  const methodOptions = PAYMENT_METHODS.map((m) => ({
    value: m,
    label: t(`method_${m}`),
  }));

  const lockedName = customerLock?.full_name ?? editing?.customer?.full_name ?? null;

  const onFinish = (v: Values) =>
    start(async () => {
      const num = (s?: string) => (s == null || s === "" ? null : Number(s));
      const input: AppointmentInput = {
        customer_id: v.customer_id,
        technician_id: v.technician_id || null,
        // Không chọn ngày = chờ xếp lịch; có ngày thiếu giờ mặc định 09:00.
        scheduled_at: v.scheduled_date
          ? new Date(`${v.scheduled_date}T${v.scheduled_time || "09:00"}`).toISOString()
          : null,
        duration_minutes: v.duration_minutes ?? 60,
        source: v.source || null,
        payment_method: (v.payment_method || null) as PaymentMethod | null,
        total_amount: num(v.total_amount), // ghi vào SỔ (khách, dịch vụ)
        booking_note: v.booking_note || null,
        internal_note: v.internal_note || null,
        service_ids: [v.service_id],
        // Cọc ban đầu chỉ khi TẠO — thành dòng deposit trong sổ thanh toán.
        deposit: editing ? undefined : { amount: num(v.deposit_amount) ?? 0 },
      };
      const res = editing
        ? await updateAppointment(editing.id, input)
        : await createAppointment(input);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? t("updateOk") : t("createOk"));
      onClose();
    });

  const required = [{ required: true, message: t("required") }];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={560}
      destroyOnHidden
      title={editing ? t("editTitle") : t("createTitle")}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button type="primary" loading={pending} onClick={() => form.submit()}>
            {editing ? t("save") : t("createSubmit")}
          </Button>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={initialValues}
        onFinish={onFinish}
      >
        <Form.Item
          label={
            <span className="flex items-center gap-2">
              {t("customer")}
              {isReturning(wCustomerId) && (
                <Tag color="blue" variant="solid" className="me-0">
                  {t("returningCustomer")}
                </Tag>
              )}
            </span>
          }
        >
          {lockedName && <Input value={lockedName} disabled />}
          {/* Khách bị khóa vẫn giữ field (ẩn) để onFinish có customer_id. */}
          <Form.Item name="customer_id" rules={required} hidden={!!lockedName} noStyle>
            <ClearableSelect
              clearable={false}
              searchable
              options={customerOptions}
              placeholder={t("pickCustomer")}
              ariaLabel={t("customer")}
              onChange={onCustomerChange}
            />
          </Form.Item>
        </Form.Item>
        <Form.Item name="scheduled_date" label={t("date")}>
          <DatePicker placeholder={t("waitingDate")} />
        </Form.Item>
        <Form.Item name="scheduled_time" label={t("time")}>
          <TimePicker />
        </Form.Item>
        <Form.Item name="duration_minutes" label={t("duration")}>
          <InputNumber min={0} className="w-full" />
        </Form.Item>
        <Form.Item name="technician_id" label={t("colTechnician")}>
          <ClearableSelect
            options={technicianOptions}
            placeholder={t("noneOption")}
            ariaLabel={t("colTechnician")}
          />
        </Form.Item>
        <Form.Item name="source" label={t("source")}>
          <ClearableSelect
            options={sourceOptions}
            placeholder={t("noneOption")}
            ariaLabel={t("source")}
          />
        </Form.Item>
        <Form.Item name="service_id" label={t("colServices")} rules={required}>
          <ClearableSelect
            clearable={false}
            options={serviceOpts}
            placeholder={t("pickServices")}
            ariaLabel={t("colServices")}
            // Form.Item tự ghi giá trị; đây chỉ chạy thêm hiệu ứng phụ.
            onChange={(v) => syncTotalFromLedger(wCustomerId, v)}
          />
        </Form.Item>
        <Form.Item
          name="total_amount"
          label={t("totalAmount")}
          // Khách cũ cùng dịch vụ → nối SỔ hiện có (tiền dùng chung)
          extra={
            !editing && liveLedger
              ? t("ledgerHint", { paid: formatRupiah(ledgerPaid(liveLedger)) })
              : undefined
          }
        >
          <CurrencyInput placeholder={t("currencyPlaceholder")} />
        </Form.Item>
        {editing ? (
          // Sửa: tiền đã thu nằm trong sổ thanh toán — chỉ xem + mở dialog.
          <Form.Item label={t("colPaid")}>
            <div className="flex items-center gap-2">
              <Input value={formatRupiah(paidTotal(editing))} disabled />
              {onOpenPayments && (
                <Button
                  icon={<Wallet className="size-4" />}
                  onClick={() => onOpenPayments(editing.id)}
                >
                  {t("payments")}
                </Button>
              )}
            </div>
          </Form.Item>
        ) : (
          <Form.Item name="deposit_amount" label={t("deposit")}>
            <CurrencyInput placeholder={t("currencyPlaceholder")} />
          </Form.Item>
        )}
        <Form.Item name="payment_method" label={t("paymentMethod")}>
          <ClearableSelect
            options={methodOptions}
            placeholder={t("noneOption")}
            ariaLabel={t("paymentMethod")}
          />
        </Form.Item>
        <Form.Item name="booking_note" label={t("bookingNote")}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="internal_note" label={t("internalNote")} className="mb-0">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
