"use client";

import { useState, useTransition } from "react";
import { Button, Input, InputNumber, Select } from "antd";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormDrawer } from "@/components/common/form-drawer";
import { useServiceGroups } from "@/components/common/service-groups";
import { formatRupiah, sanitizeCurrencyInput } from "@/lib/currency";
import { toast } from "@/lib/toast";
import type { Service } from "@/types/service";

export type CardItemInput = { service_id: string; price: number; sessions: number };
type Line = CardItemInput & { key: number };

/** Ô tiền IDR (định dạng 1.000.000) — dùng chung các form thẻ. */
export function MoneyInput(props: { value?: number | null; onChange?: (v: number | null) => void; min?: number; className?: string; ariaLabel?: string }) {
  return <InputNumber<number> className={props.className ?? "w-full"} min={props.min ?? 0} precision={0} controls={false} placeholder="Rp"
    inputMode="numeric" aria-label={props.ariaLabel} value={props.value} onChange={props.onChange}
    formatter={(v) => (v == null || `${v}` === "" ? "" : Number(v).toLocaleString("id-ID"))}
    parser={(v) => {
      const neg = (v ?? "").trim().startsWith("-");
      const n = Number(sanitizeCurrencyInput(v ?? ""));
      return (neg ? -n : n) as unknown as number;
    }} />;
}

/** Ô chọn dịch vụ theo nhóm (bảng giá) — chọn 1 lần thêm 1 dòng. */
export function useServiceOptions(services: Service[]) {
  const groups = useServiceGroups();
  const active = services.filter((s) => s.is_active);
  return groups.groups.filter((g) => active.some((s) => s.group_id === g.id)).map((g) => ({
    label: g.name,
    title: g.name,
    options: active.filter((s) => s.group_id === g.id)
      .map((s) => ({ value: s.id, label: `${s.name} · ${formatRupiah(s.price)}`, title: `${g.name} ${s.name}` })),
  }));
}

/**
 * Drawer chọn dịch vụ cho thẻ liệu trình — dùng khi bán thẻ (Sales Management, có `deposit` để trừ)
 * và khi bán thêm dịch vụ vào thẻ. Giá bán mặc định = bảng giá, sửa được (giảm giá); số buổi mặc định 1.
 */
export function CardItemsDrawer({ open, title, submitText, services, deposit, onSubmit, onClose }: {
  open: boolean;
  title: React.ReactNode;
  submitText: string;
  services: Service[];
  /** Cọc chưa dùng của khách sẽ trừ vào thẻ (chỉ khi tạo thẻ). */
  deposit?: number;
  onSubmit: (items: CardItemInput[], note: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslations("cards");
  const groups = useServiceGroups();
  const options = useServiceOptions(services);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const byId = new Map(services.map((s) => [s.id, s]));
  const total = lines.reduce((s, l) => s + (l.price ?? 0), 0);
  const due = total - (deposit ?? 0);

  const close = () => { setLines([]); setNote(""); onClose(); };
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const submit = () => {
    if (!lines.length) return void toast.error(t("needItems"));
    start(async () => {
      if (await onSubmit(lines.map(({ service_id, price, sessions }) => ({ service_id, price: price ?? 0, sessions: sessions ?? 1 })), note)) close();
    });
  };

  return <FormDrawer open={open} onClose={close} title={title} submitText={submitText} pending={pending} width={560} onSubmit={submit}>
    <div className="flex flex-col gap-4">
      <Select showSearch={{ optionFilterProp: "title" }} value={null} placeholder={t("addService")} aria-label={t("addService")}
        options={options} disabled={pending}
        onChange={(id: string) => {
          const s = byId.get(id);
          if (s) setLines((ls) => [...ls, { key: Math.random(), service_id: s.id, price: s.price, sessions: 1 }]);
        }} />

      {lines.length ? <ul className="flex flex-col gap-3">
        {lines.map((l) => {
          const s = byId.get(l.service_id);
          return <li key={l.key} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">{s?.name}</div>
                <div className="text-xs text-muted-foreground">{s ? groups.name(s.group_id) : ""}{s ? ` · ${t("listPrice")} ${formatRupiah(s.price)}` : ""}</div>
              </div>
              <Button type="text" size="small" aria-label={t("removeLine")} icon={<X className="size-4" />} disabled={pending}
                onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} />
            </div>
            <div className="grid grid-cols-[1fr_8rem] gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("price")}
                <MoneyInput value={l.price} ariaLabel={t("price")} onChange={(v) => update(l.key, { price: v ?? 0 })} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("sessions")}
                <InputNumber<number> className="w-full" min={1} max={100} precision={0} value={l.sessions} aria-label={t("sessions")}
                  onChange={(v) => update(l.key, { sessions: v ?? 1 })} />
              </label>
            </div>
          </li>;
        })}
      </ul> : <p className="text-sm text-muted-foreground">{t("emptyItems")}</p>}

      <dl className="grid grid-cols-[1fr_auto] gap-y-2 rounded-lg border border-border p-4 text-sm tabular-nums">
        <dt className="text-muted-foreground">{t("value")}</dt><dd className="text-right font-medium">{formatRupiah(total)}</dd>
        {deposit !== undefined ? <>
          <dt className="text-muted-foreground">{t("depositUsed")}</dt><dd className="text-right text-success">− {formatRupiah(deposit)}</dd>
          <dt className="font-medium">{due < 0 ? t("refundOwed") : t("due")}</dt>
          <dd className="text-right font-semibold text-warning">{formatRupiah(Math.abs(due))}</dd>
        </> : null}
      </dl>

      <label className="flex flex-col gap-1 text-sm">{t("note")}
        <Input.TextArea value={note} onChange={(e) => setNote(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} />
      </label>
    </div>
  </FormDrawer>;
}
