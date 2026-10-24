"use client";

import { useState, useTransition } from "react";
import { Button, Modal } from "antd";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";

import {
  addAppointmentUpsale,
  deleteAppointmentUpsale,
} from "@/app/(app)/appointments/actions";
import { upsaleTotal } from "@/lib/appointments";
import { formatRupiah } from "@/lib/currency";
import { serviceName } from "@/lib/customers";
import { toast } from "@/lib/toast";
import { ClearableSelect } from "@/components/common/clearable-select";
import { ConfirmAction } from "@/components/common/confirm-action";
import { CurrencyInput } from "@/components/common/currency-input";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import type { Appointment, AppointmentUpsale } from "@/types/appointment";
import type { Service } from "@/types/service";

export function UpsalesDialog({
  appointment,
  staff,
  services,
  currentUserId,
  currentUserIsAdmin,
  onClose,
}: {
  appointment: Appointment | null;
  staff: StaffRef[];
  services: Service[];
  currentUserId: string;
  currentUserIsAdmin: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [serviceId, setServiceId] = useState("");
  const [amount, setAmount] = useState("");

  const rows = appointment?.upsales ?? [];
  const canAdd =
    !!appointment &&
    (appointment.status === "checked_in" ||
      appointment.status === "completed");
  const serviceOptions = services
    .filter((service) => service.is_active)
    .map((service) => ({
      value: service.id,
      label: serviceName(service, locale),
    }));
  const selectedServiceName = (id: string) => {
    const service = services.find((item) => item.id === id);
    return service ? serviceName(service, locale) : t("unknownService");
  };

  const submit = () =>
    start(async () => {
      if (!appointment) return;
      const res = await addAppointmentUpsale(
        appointment.id,
        serviceId,
        Number(amount),
      );
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("upsaleAdded"));
      setServiceId("");
      setAmount("");
    });

  const remove = async (row: AppointmentUpsale) => {
    const res = await deleteAppointmentUpsale(row.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(t("upsaleDeleted"));
  };

  const close = () => {
    setServiceId("");
    setAmount("");
    onClose();
  };

  return (
    <Modal
      open={appointment !== null}
      onCancel={close}
      footer={null}
      width={480}
      title={t("upsalesTitle", { name: appointment?.customer?.full_name ?? "" })}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded bg-muted px-3 py-2 text-sm">
          <span>{t("upsaleTotal")}</span>
          <span className="font-semibold tabular-nums">
            {formatRupiah(upsaleTotal(rows))}
          </span>
        </div>

        <ul className="max-h-[40vh] space-y-2 overflow-y-auto">
          {rows.length === 0 && (
            <li className="text-sm text-muted-foreground">{t("upsalesEmpty")}</li>
          )}
          {rows.map((row) => {
            const creator = staff.find((user) => user.id === row.created_by);
            const canDelete = currentUserIsAdmin || row.created_by === currentUserId;
            return (
              <li key={row.id} className="surface flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {selectedServiceName(row.service_id)}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatRupiah(row.amount)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <span>{new Date(row.created_at).toLocaleString(locale)}</span>
                    {creator && (
                      <>
                        <span aria-hidden="true">·</span>
                        {staffLabel(creator)}
                      </>
                    )}
                  </div>
                </div>
                {canDelete && (
                  <ConfirmAction
                    title={t("deleteUpsaleConfirm")}
                    description={`${selectedServiceName(row.service_id)} · ${formatRupiah(row.amount)}`}
                    okText={t("delete")}
                    cancelText={t("cancel")}
                    onConfirm={() => remove(row)}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      title={t("delete")}
                      aria-label={t("delete")}
                      icon={<Trash2 className="size-4" />}
                    />
                  </ConfirmAction>
                )}
              </li>
            );
          })}
        </ul>

        {canAdd ? (
          <div className="surface flex flex-col gap-2 p-2.5">
            <ClearableSelect
              value={serviceId}
              onChange={setServiceId}
              options={serviceOptions}
              placeholder={t("pickUpsaleService")}
              ariaLabel={t("upsaleService")}
            />
            <div className="flex items-center gap-2">
              <CurrencyInput
                value={amount}
                onChange={setAmount}
                placeholder={t("upsaleAmount")}
                className="flex-1"
              />
              <Button
                type="primary"
                icon={<Plus className="size-4" />}
                loading={pending}
                disabled={!serviceId || !amount || Number(amount) <= 0}
                onClick={submit}
              >
                {t("addUpsale")}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("upsalePermissionHint")}</p>
        )}
      </div>
    </Modal>
  );
}
