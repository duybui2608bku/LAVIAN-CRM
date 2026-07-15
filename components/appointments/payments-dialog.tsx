"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

import {
  addPayment,
  deletePayment,
  setLedgerClosed,
} from "@/app/(app)/appointments/actions";
import { outstanding, paidTotal } from "@/lib/appointments";
import { formatVnd } from "@/lib/currency";
import { serviceName } from "@/lib/customers";
import { removeImage } from "@/lib/supabase/storage";
import { ClearableSelect } from "@/components/common/clearable-select";
import { CurrencyInput } from "@/components/common/currency-input";
import { EnumTag } from "@/components/common/enum-tag";
import { ImageUpload } from "@/components/common/image-upload";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  PAYMENT_METHODS,
  type Appointment,
  type AppointmentPayment,
  type PaymentKind,
  type PaymentMethod,
} from "@/types/appointment";
import type { Locale } from "@/i18n/config";
import type { Service } from "@/types/service";

// Màu tag loại dòng sổ — hardcode như STATUS_META (không vào enum_options).
const KIND_COLOR: Record<PaymentKind, string> = {
  deposit: "#0ea5e9",
  payment: "#22c55e",
  refund: "#ef4444",
};

/** 1 dòng sổ tiền (ảnh chứng từ, loại, số tiền, phương thức, người tạo) —
 *  dùng chung dialog Thanh toán + lịch sử thanh toán ở /customers.
 *  `action` = nút cuối dòng (vd. xóa); `serviceLabel` = badge dịch vụ. */
export function PaymentLine({
  payment: p,
  staff,
  serviceLabel,
  action,
}: {
  payment: AppointmentPayment;
  staff: StaffRef[];
  serviceLabel?: string | null;
  action?: React.ReactNode;
}) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const creator = p.created_by
    ? staff.find((x) => x.id === p.created_by)
    : undefined;
  return (
    <li className="flex items-center gap-2 rounded-md border px-2.5 py-2">
      {p.image_url && (
        <a href={p.image_url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.image_url}
            alt=""
            className="size-10 rounded-md border object-cover"
          />
        </a>
      )}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <EnumTag label={t(`kind_${p.kind}`)} color={KIND_COLOR[p.kind]} />
          <span
            className={
              p.kind === "refund"
                ? "font-medium text-destructive tabular-nums"
                : "font-medium tabular-nums"
            }
          >
            {p.kind === "refund" ? "−" : ""}
            {formatVnd(p.amount)}
          </span>
          {p.payment_method && (
            <span className="text-xs text-muted-foreground">
              {t(`method_${p.payment_method}`)}
            </span>
          )}
          {serviceLabel && <Badge variant="secondary">{serviceLabel}</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {new Date(p.paid_at).toLocaleString(locale)}
          </span>
          {creator ? staffLabel(creator) : null}
          {p.note && <span className="truncate">{p.note}</span>}
        </div>
      </div>
      {action}
    </li>
  );
}

/**
 * Dialog "Thanh toán" — hiển thị SỔ TIỀN của (khách, dịch vụ) mà lịch hẹn
 * thuộc về: dòng thu/hoàn của MỌI buổi hẹn trong liệu trình (kèm ảnh chứng từ,
 * người tạo) + form thêm dòng + xóa dòng ghi nhầm + nút Tất toán / Mở lại.
 * Dòng sổ bất biến — không sửa. Lịch cũ không sổ: chỉ xem dòng gắn lịch.
 */
export function PaymentsDialog({
  appointment,
  staff,
  services,
  onClose,
  onDone,
}: {
  appointment: Appointment | null; // null = đóng
  staff: StaffRef[];
  services: Service[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const [pending, start] = useTransition();

  const [kind, setKind] = useState<PaymentKind>("payment");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [deleting, setDeleting] = useState<AppointmentPayment | null>(null);

  const resetForm = () => {
    setKind("payment");
    setAmount("");
    setMethod("");
    setImageUrl(null);
    setNote("");
  };

  const submit = () =>
    start(async () => {
      if (!appointment) return;
      const res = await addPayment(appointment.id, {
        kind,
        amount: Number(amount),
        payment_method: (method || null) as PaymentMethod | null,
        image_url: imageUrl,
        note: note || null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("paymentAdded"));
      resetForm();
      onDone();
    });

  const confirmDelete = () => {
    const p = deleting;
    if (!p) return;
    setDeleting(null);
    start(async () => {
      const res = await deletePayment(p.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.image_url) void removeImage(res.image_url); // dọn ảnh best-effort
      toast.success(t("deleteOk"));
      onDone();
    });
  };

  const ledger = appointment?.ledger ?? null;
  const closed = !!ledger?.closed_at;
  // Dòng hiển thị: theo SỔ (mọi buổi của liệu trình); lịch cũ không sổ → theo lịch.
  const rows = ledger ? ledger.payments : (appointment?.payments ?? []);
  const svc = ledger ? services.find((s) => s.id === ledger.service_id) : null;
  const titleName = [
    appointment?.customer?.full_name ?? "",
    svc ? serviceName(svc, locale) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const paid = appointment ? paidTotal(appointment) : 0;
  const owed = appointment ? outstanding(appointment) : 0;
  // Thu thêm không được vượt số còn phải thu (tổng giá sổ − đã thu):
  // nhập quá → ép về đúng số còn nợ. Sổ chưa có tổng giá thì không chặn.
  const hasBase = ledger?.total_amount != null;
  const cap = (v: string, k: PaymentKind) =>
    k === "payment" && hasBase && Number(v) > owed ? String(owed) : v;

  const toggleClosed = (next: boolean) =>
    start(async () => {
      if (!ledger) return;
      const res = await setLedgerClosed(ledger.id, next);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("statusOk"));
      onDone();
    });

  return (
    <>
      <Dialog open={appointment !== null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("paymentsTitle", { name: titleName })}
            </DialogTitle>
          </DialogHeader>

          <ul className="max-h-[40vh] space-y-2 overflow-y-auto">
            {rows.length === 0 && (
              <li className="text-sm text-muted-foreground">
                {t("paymentsEmpty")}
              </li>
            )}
            {rows.map((p) => (
              <PaymentLine
                key={p.id}
                payment={p}
                staff={staff}
                action={
                  <Button
                    size="sm"
                    variant="ghost"
                    title={t("delete")}
                    aria-label={t("delete")}
                    disabled={pending}
                    onClick={() => setDeleting(p)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                }
              />
            ))}
          </ul>

          <div className="flex items-center justify-between gap-2">
            {/* Tất toán / mở lại sổ — sổ đóng thì lịch mới cùng dịch vụ mở sổ mới */}
            {ledger ? (
              closed ? (
                <span className="flex items-center gap-2">
                  <EnumTag label={t("ledgerClosed")} color="#64748b" />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => toggleClosed(false)}
                  >
                    {t("reopenLedger")}
                  </Button>
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => toggleClosed(true)}
                >
                  {t("closeLedger")}
                </Button>
              )
            ) : (
              <span className="text-xs text-muted-foreground">
                {t("noLedgerHint")}
              </span>
            )}
            <p className="text-right text-sm tabular-nums">
              {ledger?.total_amount != null && (
                <>
                  {t("totalAmount")}:{" "}
                  <span className="font-medium">
                    {formatVnd(ledger.total_amount)}
                  </span>
                  {" · "}
                </>
              )}
              {t("colPaid")}:{" "}
              <span className="font-medium">{formatVnd(paid)}</span>
              {owed > 0 && (
                <span className="text-destructive">
                  {" · "}
                  {t("colOutstanding")}: {formatVnd(owed)}
                </span>
              )}
            </p>
          </div>

          {/* Form thêm dòng: thu thêm / hoàn tiền (cọc chỉ ghi lúc tạo lịch);
              ẩn khi không có sổ hoặc sổ đã tất toán. */}
          {ledger && !closed && (
          <div className="space-y-2 rounded-md border p-2.5">
            <ClearableSelect
              value={kind}
              onValueChange={(v) => {
                const k = v as PaymentKind;
                setKind(k);
                setAmount((a) => cap(a, k));
              }}
              clearable={false}
              options={(["payment", "refund"] as const).map((k) => ({
                value: k,
                label: t(`kind_${k}`),
              }))}
              placeholder={t("kind_payment")}
              ariaLabel={t("paymentKind")}
              className="w-full"
            />
            <CurrencyInput
              locale={locale as Locale}
              value={amount}
              onValueChange={(v) => setAmount(cap(v, kind))}
              placeholder={t("currencyPlaceholder")}
              aria-label={t("amount")}
            />
            <ClearableSelect
              value={method}
              onValueChange={setMethod}
              options={PAYMENT_METHODS.map((m) => ({
                value: m,
                label: t(`method_${m}`),
              }))}
              placeholder={t("paymentMethod")}
              clearLabel={t("clear")}
              ariaLabel={t("paymentMethod")}
              className="w-full"
            />
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("colNote")}
            />
            <div className="flex items-end justify-between gap-2">
              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                label={t("receiptImage")}
                className="w-24"
              />
              <Button
                size="sm"
                disabled={pending || !amount || Number(amount) <= 0}
                onClick={submit}
              >
                {pending ? (
                  <RefreshCw className="animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {t("addPayment")}
              </Button>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deletePaymentConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting &&
                `${t(`kind_${deleting.kind}`)} · ${formatVnd(deleting.amount)}`}
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
