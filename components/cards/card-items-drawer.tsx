"use client";

import { useState, useTransition } from "react";
import { Button, Checkbox, Empty, Input, InputNumber } from "antd";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormDrawer } from "@/components/common/form-drawer";
import { MoneyInput } from "@/components/common/money-input";
import { Section } from "@/components/common/section";
import { useServiceGroups } from "@/components/common/service-groups";
import { groupTaken } from "@/lib/cards";
import { formatIdr, formatRupiah } from "@/lib/currency";
import { toast } from "@/lib/toast";
import type { Service } from "@/types/service";

export type CardItemInput = { service_id: string; price: number; sessions: number };

/**
 * Drawer chọn dịch vụ cho thẻ liệu trình — dùng khi bán thẻ (Sales Management, có `deposit` để trừ)
 * và khi bán thêm dịch vụ vào thẻ. Trái: cả bảng giá dạng checkbox theo nhóm (như tờ bảng giá giấy, không cần cuộn);
 * phải: dịch vụ đã chọn — giá bán mặc định = bảng giá, sửa được (giảm giá / voucher), số buổi mặc định 1.
 */
export function CardItemsDrawer({ open, title, submitText, services, deposit, existing = [], beside, onSubmit, onClose }: {
  open: boolean;
  title: React.ReactNode;
  submitText: string;
  services: Service[];
  /** Cọc chưa dùng của khách sẽ trừ vào thẻ (chỉ khi tạo thẻ). */
  deposit?: number;
  /** service_id các DV chưa hoàn đang có trong thẻ (bán thêm) — chặn chọn trùng nhóm. */
  existing?: string[];
  /** Mở cạnh drawer thẻ (rộng `beside` px) thay vì đè lên. */
  beside?: number;
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
  const toggle = (s: Service, on: boolean) => {
    if (on) {
      const taken = [...existing, ...lines.map((l) => l.service_id)].flatMap((id) => byId.get(id) ?? []);
      if (groupTaken(s, taken)) return void toast.error(t("error.sameGroup", { group: groups.name(s.group_id) }));
    }
    setLines((ls) => on
      ? [...ls, { service_id: s.id, price: s.price, sessions: 1 }]
      : ls.filter((l) => l.service_id !== s.id));
  };
  const update = (id: string, patch: Partial<CardItemInput>) =>
    setLines((ls) => ls.map((l) => (l.service_id === id ? { ...l, ...patch } : l)));
  const submit = () => {
    if (!lines.length) return void toast.error(t("needItems"));
    start(async () => {
      if (await onSubmit(lines.map((l) => ({ ...l, price: l.price ?? 0, sessions: l.sessions ?? 1 })), note)) close();
    });
  };

  // Bố cục theo bề rộng drawer (container query) — mở cạnh drawer thẻ thì hẹp hơn màn hình.
  return <FormDrawer open={open} onClose={close} title={title} submitText={submitText} pending={pending} width={1120} beside={beside} onSubmit={submit}>
    <div className="@container"><div className="grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* Bảng giá: mỗi nhóm 1 khối, 2 cột khi đủ rộng. */}
      <div className="@container"><div className="columns-1 gap-6 @md:columns-2">
        {sections.map(({ group, items }) => <section key={group.id} className="mb-4 break-inside-avoid">
          <h4 className="mb-1 border-b border-border pb-1 text-xs font-semibold tracking-wide text-primary uppercase">{group.name}</h4>
          <ul>
            {items.map((s) => {
              const on = picked.has(s.id);
              return <li key={s.id}>
                <label className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted ${on ? "bg-primary/5 font-medium" : ""}`}>
                  <Checkbox checked={on} disabled={pending} onChange={(e) => toggle(s, e.target.checked)} />
                  <span className="min-w-0 flex-1">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatIdr(s.price)}</span>
                </label>
              </li>;
            })}
          </ul>
        </section>)}
      </div></div>

      {/* Đã chọn + tạm tính — dính trên khi cuộn (khi 2 cột). */}
      <Section title={t("selected", { count: lines.length })} className="self-start @3xl:sticky @3xl:top-0">
        {lines.length ? <ul className="flex flex-col gap-2">
          {lines.map((l) => {
            const s = byId.get(l.service_id);
            return <li key={l.service_id} className="rounded-lg border border-border p-2.5">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div className="min-w-0 text-sm">
                  <div className="font-medium">{s?.name}</div>
                  <div className="text-xs text-muted-foreground">{s ? groups.name(s.group_id) : ""}</div>
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
        </ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("emptyItems")} />}

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
      </Section>
    </div></div>
  </FormDrawer>;
}
