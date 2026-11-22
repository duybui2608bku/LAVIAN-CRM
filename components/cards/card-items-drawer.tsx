"use client";

import { useState, useTransition } from "react";
import { Button, Checkbox, Input, InputNumber } from "antd";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormDrawer } from "@/components/common/form-drawer";
import { useServiceGroups } from "@/components/common/service-groups";
import { formatRupiah, sanitizeCurrencyInput } from "@/lib/currency";
import { toast } from "@/lib/toast";
import type { Service } from "@/types/service";

export type CardItemInput = { service_id: string; price: number; sessions: number };

/** Ô tiền IDR (định dạng 1.000.000) — dùng chung các form thẻ. */
export function MoneyInput(props: { value?: number | null; onChange?: (v: number | null) => void; min?: number; className?: string; ariaLabel?: string; size?: "small" }) {
  return <InputNumber<number> className={props.className ?? "w-full"} min={props.min ?? 0} precision={0} controls={false} placeholder="Rp"
    inputMode="numeric" aria-label={props.ariaLabel} value={props.value} onChange={props.onChange} size={props.size}
    formatter={(v) => (v == null || `${v}` === "" ? "" : Number(v).toLocaleString("id-ID"))}
    parser={(v) => {
      const neg = (v ?? "").trim().startsWith("-");
      const n = Number(sanitizeCurrencyInput(v ?? ""));
      return (neg ? -n : n) as unknown as number;
    }} />;
}

const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/**
 * Drawer chọn dịch vụ cho thẻ liệu trình — dùng khi bán thẻ (Sales Management, có `deposit` để trừ)
 * và khi bán thêm dịch vụ vào thẻ. Trái: cả bảng giá dạng checkbox theo nhóm (như tờ bảng giá giấy, không cần cuộn);
 * phải: dịch vụ đã chọn — giá bán mặc định = bảng giá, sửa được (giảm giá / voucher), số buổi mặc định 1.
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
  const [lines, setLines] = useState<CardItemInput[]>([]);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const byId = new Map(services.map((s) => [s.id, s]));
  const active = services.filter((s) => s.is_active);
  const sections = groups.groups.map((g) => ({ group: g, items: active.filter((s) => s.group_id === g.id) })).filter((x) => x.items.length);
  const picked = new Set(lines.map((l) => l.service_id));
  const total = lines.reduce((s, l) => s + (l.price ?? 0), 0);
  const listTotal = lines.reduce((s, l) => s + (byId.get(l.service_id)?.price ?? 0), 0);
  const due = total - (deposit ?? 0);

  const close = () => { setLines([]); setNote(""); onClose(); };
  const toggle = (s: Service, on: boolean) => setLines((ls) => on
    ? [...ls, { service_id: s.id, price: s.price, sessions: 1 }]
    : ls.filter((l) => l.service_id !== s.id));
  const update = (id: string, patch: Partial<CardItemInput>) =>
    setLines((ls) => ls.map((l) => (l.service_id === id ? { ...l, ...patch } : l)));
  const submit = () => {
    if (!lines.length) return void toast.error(t("needItems"));
    start(async () => {
      if (await onSubmit(lines.map((l) => ({ ...l, price: l.price ?? 0, sessions: l.sessions ?? 1 })), note)) close();
    });
  };

  return <FormDrawer open={open} onClose={close} title={title} submitText={submitText} pending={pending} width={1120} onSubmit={submit}>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Bảng giá: mỗi nhóm 1 khối, 2 cột (điện thoại 1 cột). */}
      <div className="columns-1 gap-6 sm:columns-2">
        {sections.map(({ group, items }) => <section key={group.id} className="mb-4 break-inside-avoid">
          <h4 className="mb-1 border-b border-border pb-1 text-xs font-semibold tracking-wide text-primary uppercase">{group.name}</h4>
          <ul>
            {items.map((s) => {
              const on = picked.has(s.id);
              return <li key={s.id}>
                <label className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted ${on ? "bg-primary/5 font-medium" : ""}`}>
                  <Checkbox checked={on} disabled={pending} onChange={(e) => toggle(s, e.target.checked)} />
                  <span className="min-w-0 flex-1">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{s.price ? idr.format(s.price) : "0"}</span>
                </label>
              </li>;
            })}
          </ul>
        </section>)}
      </div>

      {/* Đã chọn + tạm tính — dính trên khi cuộn (desktop). */}
      <aside className="flex flex-col gap-3 self-start lg:sticky lg:top-0">
        <h4 className="font-semibold">{t("selected", { count: lines.length })}</h4>
        {lines.length ? <ul className="flex flex-col gap-2">
          {lines.map((l) => {
            const s = byId.get(l.service_id);
            return <li key={l.service_id} className="rounded-lg border border-border p-2.5">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div className="min-w-0 text-sm">
                  <div className="font-medium">{s?.name}</div>
                  <div className="text-xs text-muted-foreground">{s ? `${groups.name(s.group_id)} · ${t("listPrice")} ${idr.format(s.price)}` : ""}</div>
                </div>
                <Button type="text" size="small" aria-label={t("removeLine")} icon={<X className="size-4" />} disabled={pending}
                  onClick={() => s && toggle(s, false)} />
              </div>
              <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                <MoneyInput size="small" value={l.price} ariaLabel={t("price")} onChange={(v) => update(l.service_id, { price: v ?? 0 })} />
                <InputNumber<number> size="small" className="w-full" min={1} max={100} precision={0} value={l.sessions}
                  aria-label={t("sessions")} suffix={t("sessionsShort")} onChange={(v) => update(l.service_id, { sessions: v ?? 1 })} />
              </div>
            </li>;
          })}
        </ul> : <p className="text-sm text-muted-foreground">{t("emptyItems")}</p>}

        <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 rounded-lg border border-border p-3 text-sm tabular-nums">
          {listTotal !== total ? <>
            <dt className="text-muted-foreground">{t("listTotal")}</dt><dd className="text-right">{formatRupiah(listTotal)}</dd>
            <dt className="text-muted-foreground">{t("discount")}</dt><dd className="text-right">− {formatRupiah(listTotal - total)}</dd>
          </> : null}
          <dt className="text-muted-foreground">{t("value")}</dt><dd className="text-right font-medium">{formatRupiah(total)}</dd>
          {deposit !== undefined ? <>
            <dt className="text-muted-foreground">{t("depositUsed")}</dt><dd className="text-right text-success">− {formatRupiah(deposit)}</dd>
            <dt className="font-medium">{due < 0 ? t("refundOwed") : t("due")}</dt>
            <dd className="text-right font-semibold text-warning">{formatRupiah(Math.abs(due))}</dd>
          </> : null}
        </dl>

        <Input.TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("note")} aria-label={t("note")}
          autoSize={{ minRows: 2, maxRows: 5 }} maxLength={2000} />
      </aside>
    </div>
  </FormDrawer>;
}
