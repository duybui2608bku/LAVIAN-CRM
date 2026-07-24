"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addAppointmentUpsale,
  deleteAppointmentUpsale,
} from "@/app/(app)/appointments/actions";
import { upsaleTotal } from "@/lib/appointments";
import { formatRupiah } from "@/lib/currency";
import { serviceName } from "@/lib/customers";
import { ClearableSelect } from "@/components/common/clearable-select";
import { CurrencyInput } from "@/components/common/currency-input";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Appointment, AppointmentUpsale } from "@/types/appointment";
import type { Service } from "@/types/service";

export function UpsalesDialog({
  appointment,
  staff,
  services,
  currentUserId,
  currentUserIsAdmin,
  onClose,
  onDone,
}: {
  appointment: Appointment | null;
  staff: StaffRef[];
  services: Service[];
  currentUserId: string;
  currentUserIsAdmin: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [serviceId, setServiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [deleting, setDeleting] = useState<AppointmentUpsale | null>(null);

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
      onDone();
    });

  const confirmDelete = () => {
    const row = deleting;
    if (!row) return;
    setDeleting(null);
    start(async () => {
      const res = await deleteAppointmentUpsale(row.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("upsaleDeleted"));
      onDone();
    });
  };

  return (
    <>
      <Dialog
        open={appointment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setServiceId("");
            setAmount("");
            onClose();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("upsalesTitle", {
                name: appointment?.customer?.full_name ?? "",
              })}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
            <span>{t("upsaleTotal")}</span>
            <span className="font-semibold tabular-nums">
              {formatRupiah(upsaleTotal(rows))}
            </span>
          </div>

          <ul className="max-h-[40vh] space-y-2 overflow-y-auto">
            {rows.length === 0 && (
              <li className="text-sm text-muted-foreground">
                {t("upsalesEmpty")}
              </li>
            )}
            {rows.map((row) => {
              const creator = staff.find((user) => user.id === row.created_by);
              const canDelete =
                currentUserIsAdmin || row.created_by === currentUserId;
              return (
                <li
                  key={row.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2"
                >
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
                      <span>
                        {new Date(row.created_at).toLocaleString(locale)}
                      </span>
                      {creator && (
                        <>
                          <span aria-hidden="true">·</span>
                          {staffLabel(creator)}
                        </>
                      )}
                    </div>
                  </div>
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title={t("delete")}
                      aria-label={t("delete")}
                      disabled={pending}
                      onClick={() => setDeleting(row)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>

          {canAdd ? (
            <div className="space-y-2 rounded-md border p-2.5">
              <ClearableSelect
                value={serviceId}
                onValueChange={setServiceId}
                options={serviceOptions}
                placeholder={t("pickUpsaleService")}
                clearLabel={t("clear")}
                ariaLabel={t("upsaleService")}
                className="w-full"
              />
              <div className="flex items-end gap-2">
                <CurrencyInput
                  value={amount}
                  onValueChange={setAmount}
                  placeholder={t("upsaleAmount")}
                  aria-label={t("upsaleAmount")}
                />
                <Button
                  size="sm"
                  disabled={
                    pending || !serviceId || !amount || Number(amount) <= 0
                  }
                  onClick={submit}
                >
                  {pending ? (
                    <RefreshCw className="animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {t("addUpsale")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("upsalePermissionHint")}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteUpsaleConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `${selectedServiceName(deleting.service_id)} · ${formatRupiah(deleting.amount)}`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
