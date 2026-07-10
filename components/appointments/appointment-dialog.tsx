"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  createAppointment,
  updateAppointment,
} from "@/app/(app)/appointments/actions";
import { optionLabel, serviceName } from "@/lib/customers";
import { formatISODate } from "@/lib/date";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { ClearableSelect } from "@/components/common/clearable-select";
import { MultiSelect } from "@/components/common/multi-select";
import { DatePicker } from "@/components/common/date-picker";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  Appointment,
  AppointmentInput,
  PaymentMethod,
} from "@/types/appointment";
import { PAYMENT_METHODS } from "@/types/appointment";
import type { EnumOption } from "@/types/customer";
import type { Service } from "@/types/service";

// source/staff_id/service_ids: thông tin ban đầu của khách để prefill khi tạo
// lịch mới (optional — /customers truyền full Customer nên tự khớp).
export type CustomerRef = {
  id: string;
  full_name: string;
  phone: string;
  source?: string | null;
  staff_id?: string | null;
  service_ids?: string[];
};

const schema = z.object({
  customer_id: z.string().min(1),
  scheduled_date: z.string().optional(), // "" = chờ xếp lịch
  scheduled_time: z.string().optional(),
  duration_minutes: z.string().optional(),
  staff_id: z.string().optional(),
  source: z.string().optional(),
  expected_amount: z.string().optional(),
  deposit_amount: z.string().optional(),
  final_amount: z.string().optional(),
  payment_method: z.string().optional(),
  booking_note: z.string().optional(),
  internal_note: z.string().optional(),
  service_ids: z.array(z.string()).optional(),
});
type Values = z.infer<typeof schema>;

const localTime = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Class cho <textarea> ghi chú — khớp trông với <Input> (pattern customers).
const fieldCls =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

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
  onClose,
  onDone,
}: {
  open: boolean;
  editing: Appointment | null;
  customerLock?: CustomerRef | null;
  customers: CustomerRef[];
  staff: StaffRef[];
  options: EnumOption[];
  services: Service[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const [pending, start] = useTransition();

  // Prefill thông tin ban đầu của khách (nguồn/dịch vụ/nhân viên) CHỈ khi tạo
  // mới — sửa lịch giữ nguyên dữ liệu của chính lịch hẹn.
  const lock = editing ? null : customerLock;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      customer_id: editing?.customer_id ?? customerLock?.id ?? "",
      scheduled_date: editing?.scheduled_at
        ? formatISODate(new Date(editing.scheduled_at))
        : "",
      scheduled_time: editing?.scheduled_at
        ? localTime(editing.scheduled_at)
        : "09:00",
      duration_minutes: String(editing?.duration_minutes ?? 60),
      staff_id: editing?.staff_id ?? lock?.staff_id ?? "",
      source: editing?.source ?? lock?.source ?? "",
      expected_amount: editing?.expected_amount?.toString() ?? "",
      deposit_amount: editing?.deposit_amount?.toString() ?? "0",
      final_amount: editing?.final_amount?.toString() ?? "",
      payment_method: editing?.payment_method ?? "",
      booking_note: editing?.booking_note ?? "",
      internal_note: editing?.internal_note ?? "",
      service_ids: editing?.service_ids ?? lock?.service_ids ?? [],
    },
  });

  // Option nguồn: active + giá trị hiện tại (kể cả inactive) — pattern customers.
  const sourceOptions = options
    .filter(
      (o) =>
        o.kind === "source" && (o.is_active || o.value === editing?.source),
    )
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((o) => ({ value: o.value, label: optionLabel(o, locale) }));
  // Bao luôn dịch vụ inactive đang gắn (của lịch đang sửa / khách prefill).
  const presetServiceIds = editing?.service_ids ?? lock?.service_ids ?? [];
  const serviceOpts = services
    .filter((s) => s.is_active || presetServiceIds.includes(s.id))
    .map((s) => ({ value: s.id, label: serviceName(s, locale) }));
  const staffOptions = staff.map((s) => ({ value: s.id, label: staffLabel(s) }));
  const customerOptions = customers.map((c) => ({
    value: c.id,
    label: `${c.full_name} — ${c.phone}`,
  }));
  const methodOptions = PAYMENT_METHODS.map((m) => ({
    value: m,
    label: t(`method_${m}`),
  }));

  const lockedName =
    customerLock?.full_name ?? editing?.customer?.full_name ?? null;

  const onSubmit = (v: Values) =>
    start(async () => {
      const num = (s?: string) => (s == null || s === "" ? null : Number(s));
      const input: AppointmentInput = {
        customer_id: v.customer_id,
        staff_id: v.staff_id || null,
        // Không chọn ngày = chờ xếp lịch; có ngày thiếu giờ mặc định 09:00.
        scheduled_at: v.scheduled_date
          ? new Date(
              `${v.scheduled_date}T${v.scheduled_time || "09:00"}`,
            ).toISOString()
          : null,
        duration_minutes: num(v.duration_minutes) ?? 60,
        source: v.source || null,
        payment_method: (v.payment_method || null) as PaymentMethod | null,
        deposit_amount: num(v.deposit_amount) ?? 0,
        expected_amount: num(v.expected_amount),
        final_amount: num(v.final_amount),
        booking_note: v.booking_note || null,
        internal_note: v.internal_note || null,
        service_ids: v.service_ids ?? [],
      };
      const res = editing
        ? await updateAppointment(editing.id, input)
        : await createAppointment(input);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? t("updateOk") : t("createOk"));
      reset();
      onClose();
      onDone();
    });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {editing ? t("editTitle") : t("createTitle")}
          </SheetTitle>
        </SheetHeader>
        {/* Footer nằm ngoài form (nút submit nối qua form id) — thân cuộn, footer dính đáy */}
        <form
          id="appointment-form"
          onSubmit={handleSubmit(onSubmit)}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4"
        >
          <Field
            label={t("customer")}
            error={errors.customer_id && t("required")}
          >
            {lockedName ? (
              <p className="flex min-h-8 items-center rounded-lg border border-input bg-muted/30 px-2.5 text-sm">
                {lockedName}
              </p>
            ) : (
              <Controller
                control={control}
                name="customer_id"
                render={({ field }) => (
                  <ClearableSelect
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      // Tạo mới: nạp thông tin ban đầu theo khách vừa chọn
                      // (khách chưa có → để trống, không giữ của khách trước).
                      const c = customers.find((x) => x.id === v);
                      if (!editing && c) {
                        setValue("source", c.source ?? "");
                        setValue("staff_id", c.staff_id ?? "");
                        setValue(
                          "service_ids",
                          (c.service_ids ?? []).filter((id) =>
                            serviceOpts.some((o) => o.value === id),
                          ),
                        );
                      }
                    }}
                    clearable={false}
                    options={customerOptions}
                    placeholder={t("pickCustomer")}
                    ariaLabel={t("customer")}
                  />
                )}
              />
            )}
          </Field>

          <div className="grid gap-3">
            <Field label={t("date")}>
              <Controller
                control={control}
                name="scheduled_date"
                render={({ field }) => (
                  <DatePicker
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder={t("waitingDate")}
                  />
                )}
              />
            </Field>
            <Field label={t("time")}>
              <Input type="time" {...register("scheduled_time")} />
            </Field>
          </div>

          <div className="grid gap-3">
            <Field label={t("duration")}>
              <Input type="number" min={0} {...register("duration_minutes")} />
            </Field>
            <Field label={t("colStaff")}>
              <Controller
                control={control}
                name="staff_id"
                render={({ field }) => (
                  <ClearableSelect
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    options={staffOptions}
                    placeholder={t("noneOption")}
                    clearLabel={t("clear")}
                    ariaLabel={t("colStaff")}
                  />
                )}
              />
            </Field>
          </div>

          <div className="grid gap-3">
            <Field label={t("source")}>
              <Controller
                control={control}
                name="source"
                render={({ field }) => (
                  <ClearableSelect
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    options={sourceOptions}
                    placeholder={t("noneOption")}
                    clearLabel={t("clear")}
                    ariaLabel={t("source")}
                  />
                )}
              />
            </Field>
            <Field label={t("colServices")}>
              <Controller
                control={control}
                name="service_ids"
                render={({ field }) => (
                  <MultiSelect
                    value={field.value ?? []}
                    onValueChange={field.onChange}
                    options={serviceOpts}
                    placeholder={t("pickServices")}
                    ariaLabel={t("colServices")}
                  />
                )}
              />
            </Field>
          </div>

          <div className="grid gap-3">
            <Field label={t("expected")}>
              <Input type="number" min={0} {...register("expected_amount")} />
            </Field>
            <Field label={t("deposit")}>
              <Input type="number" min={0} {...register("deposit_amount")} />
            </Field>
          </div>

          <div className="grid gap-3">
            <Field label={t("final")}>
              <Input type="number" min={0} {...register("final_amount")} />
            </Field>
            <Field label={t("paymentMethod")}>
              <Controller
                control={control}
                name="payment_method"
                render={({ field }) => (
                  <ClearableSelect
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    options={methodOptions}
                    placeholder={t("noneOption")}
                    clearLabel={t("clear")}
                    ariaLabel={t("paymentMethod")}
                  />
                )}
              />
            </Field>
          </div>

          <Field label={t("bookingNote")}>
            <textarea className={fieldCls} rows={2} {...register("booking_note")} />
          </Field>
          <Field label={t("internalNote")}>
            <textarea
              className={fieldCls}
              rows={2}
              {...register("internal_note")}
            />
          </Field>

        </form>
        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="appointment-form" disabled={pending}>
            {pending ? t("saving") : editing ? t("save") : t("createSubmit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | false;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
