"use client";

import { useState, useTransition } from "react";
import { Button, Input, Modal, Tag } from "antd";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";

import {
  addPayment,
  deletePayment,
  setLedgerClosed,
} from "@/app/(app)/appointments/actions";
import { outstanding, paidTotal, payableTotal } from "@/lib/appointments";
import { formatRupiah } from "@/lib/currency";
import { serviceName } from "@/lib/customers";
import { removeImage } from "@/lib/supabase/storage";
import { toast } from "@/lib/toast";
import { ClearableSelect } from "@/components/common/clearable-select";
import { ConfirmAction } from "@/components/common/confirm-action";
import { CurrencyInput } from "@/components/common/currency-input";
import { EnumTag } from "@/components/common/enum-tag";
import { ImageUpload } from "@/components/common/image-upload";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import {
  PAYMENT_METHODS,
  type Appointment,
  type AppointmentPayment,
  type PaymentKind,
  type PaymentMethod,
} from "@/types/appointment";
import type { Service } from "@/types/service";

// Màu tag loại dòng sổ — hardcode như STATUS_META (không vào enum_options).
const KIND_COLOR: Record<PaymentKind, string> = {
  deposit: "#13c2c2",
  payment: "#52c41a",
  refund: "#f5222d",
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
  const receiverId = p.received_by ?? p.created_by;
  const receiver = receiverId
    ? staff.find((x) => x.id === receiverId)
    : undefined;
  return (
    <li className="surface flex items-center gap-2 px-2.5 py-2">
      {p.image_url && (
        <a href={p.image_url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.image_url}
            alt=""
            className="size-10 rounded border border-border object-cover"
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
            {formatRupiah(p.amount)}
          </span>
          {p.payment_method && (
            <span className="text-xs text-muted-foreground">
              {t(`method_${p.payment_method}`)}
            </span>
          )}
          {serviceLabel && <Tag className="me-0">{serviceLabel}</Tag>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {new Date(p.paid_at).toLocaleString(locale)}
          </span>
          {receiver ? staffLabel(receiver) : null}
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
  currentUserId,
  services,
  onClose,
}: {
  appointment: Appointment | null; // null = đóng
  staff: StaffRef[];
  currentUserId: string;
  services: Service[];
  onClose: () => void;
}) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const [pending, start] = useTransition();

  const [kind, setKind] = useState<PaymentKind>("payment");
  const [amount, setAmount] = useState("");
  const [createdBy, setCreatedBy] = useState(currentUserId);
  const [method, setMethod] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const resetForm = () => {
    setKind("payment");
    setAmount("");
    setCreatedBy(currentUserId);
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
        received_by: createdBy,
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
    });

  const remove = async (p: AppointmentPayment) => {
    const res = await deletePayment(p.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.image_url) void removeImage(res.image_url); // dọn ảnh best-effort
    toast.success(t("deleteOk"));
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
  const total = appointment ? payableTotal(appointment) : null;
  const owed = appointment ? outstanding(appointment) : 0;
  // Thu thêm không được vượt số còn phải thu (tổng giá sổ − đã thu):
  // nhập quá → ép về đúng số còn nợ. Sổ chưa có tổng giá thì không chặn.
  const hasBase = total != null;
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
    });

  const close = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      open={appointment !== null}
      onCancel={close}
      footer={null}
      title={t("paymentsTitle", { name: titleName })}
    >
      <div className="space-y-3">
        <ul className="max-h-[40vh] space-y-2 overflow-y-auto">
          {rows.length === 0 && (
            <li className="text-sm text-muted-foreground">{t("paymentsEmpty")}</li>
          )}
          {rows.map((p) => (
            <PaymentLine
              key={p.id}
              payment={p}
              staff={staff}
              action={
                <ConfirmAction
                  title={t("deletePaymentConfirm")}
                  description={`${t(`kind_${p.kind}`)} · ${formatRupiah(p.amount)}`}
                  okText={t("delete")}
                  cancelText={t("cancel")}
                  onConfirm={() => remove(p)}
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
              }
            />
          ))}
        </ul>

        <div className="flex items-center justify-between gap-2">
          {/* Tất toán / mở lại sổ — sổ đóng thì lịch mới cùng dịch vụ mở sổ mới */}
          {ledger ? (
            closed ? (
              <span className="flex items-center gap-2">
                <EnumTag label={t("ledgerClosed")} color="#8c8c8c" />
                <Button size="small" loading={pending} onClick={() => toggleClosed(false)}>
                  {t("reopenLedger")}
                </Button>
              </span>
            ) : (
              <Button size="small" loading={pending} onClick={() => toggleClosed(true)}>
                {t("closeLedger")}
              </Button>
            )
          ) : (
            <span className="text-xs text-muted-foreground">{t("noLedgerHint")}</span>
          )}
          <p className="text-right text-sm tabular-nums">
            {total != null && (
              <>
                {t("colTotal")}: <span className="font-medium">{formatRupiah(total)}</span>
                {" · "}
              </>
            )}
            {t("colPaid")}: <span className="font-medium">{formatRupiah(paid)}</span>
            {owed > 0 && (
              <span className="text-destructive">
                {" · "}
                {t("colOutstanding")}: {formatRupiah(owed)}
              </span>
            )}
          </p>
        </div>

        {/* Form thêm dòng: thu thêm / hoàn tiền (cọc chỉ ghi lúc tạo lịch);
            ẩn khi không có sổ hoặc sổ đã tất toán. */}
        {ledger && !closed && (
          <div className="surface flex flex-col gap-2 p-2.5">
            <ClearableSelect
              value={kind}
              onChange={(v) => {
                const k = v as PaymentKind;
                setKind(k);
                setAmount((a) => cap(a, k));
              }}
              clearable={false}
              options={(["payment", "refund"] as const).map((k) => ({
                value: k,
                label: t(`kind_${k}`),
              }))}
              ariaLabel={t("paymentKind")}
            />
            <CurrencyInput
              value={amount}
              onChange={(v) => setAmount(cap(v, kind))}
              placeholder={t("currencyPlaceholder")}
            />
            <ClearableSelect
              value={createdBy}
              onChange={setCreatedBy}
              clearable={false}
              options={staff
                .filter((user) => user.status !== "banned")
                .map((user) => ({ value: user.id, label: staffLabel(user) }))}
              placeholder={t("paymentUser")}
              ariaLabel={t("paymentUser")}
            />
            <ClearableSelect
              value={method}
              onChange={setMethod}
              options={PAYMENT_METHODS.map((m) => ({
                value: m,
                label: t(`method_${m}`),
              }))}
              placeholder={t("paymentMethod")}
              ariaLabel={t("paymentMethod")}
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
                type="primary"
                icon={<Plus className="size-4" />}
                loading={pending}
                disabled={!createdBy || !amount || Number(amount) <= 0}
                onClick={submit}
              >
                {t("addPayment")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
