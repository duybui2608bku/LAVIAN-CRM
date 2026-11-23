"use client";

import { useState, useTransition } from "react";
import { Button, Checkbox, Empty, Input, InputNumber, Tooltip } from "antd";
import { CircleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { setPlannedTourDate } from "@/app/(app)/tour/actions";
import { DatePicker } from "@/components/common/date-picker";
import { FormDrawer } from "@/components/common/form-drawer";
import { MoneyInput } from "@/components/common/money-input";
import { Section } from "@/components/common/section";
import { useServiceGroups } from "@/components/common/service-groups";
import { kindText, runAction } from "@/components/tour/tour-drawer";
import { groupTaken, planRoadmap, tourKindDetail, type CardPlan } from "@/lib/cards";
import { formatIdr, formatRupiah } from "@/lib/currency";
import { toast } from "@/lib/toast";
import type { CardItem } from "@/types/card";
import type { Service } from "@/types/service";
import type { Tour } from "@/types/tour";

export type CardItemInput = { service_id: string; price: number; sessions: number };

/**
 * Drawer chọn dịch vụ cho thẻ liệu trình — dùng khi bán thẻ (Sales Management, có `deposit` để trừ)
 * và khi bán thêm dịch vụ vào thẻ. Trái: cả bảng giá dạng checkbox theo nhóm (như tờ bảng giá giấy, không cần cuộn);
 * phải: dịch vụ đã chọn — giá bán mặc định = bảng giá, sửa được (giảm giá / voucher), số buổi mặc định 1.
 */
export function CardItemsDrawer({ open, title, submitText, services, deposit, existing = [], currentValue, beside, planned, previewRoadmap, onSubmit, onClose }: {
  open: boolean;
  title: React.ReactNode;
  submitText: string;
  services: Service[];
  /** Cọc chưa dùng của khách sẽ trừ vào thẻ (chỉ khi tạo thẻ). */
  deposit?: number;
  /** DV chưa hoàn đang có trong thẻ (bán thêm) — hiện chỉ đọc ở "Đã chọn" + khoá nhóm đã có DV. */
  existing?: Pick<CardItem, "service_id" | "price" | "sessions">[];
  /** Giá trị thẻ hiện tại (bán thêm) → hiện giá trị thẻ sau cập nhật. */
  currentValue?: number;
  /** Mở cạnh drawer thẻ (rộng `beside` px) thay vì đè lên. */
  beside?: number;
  /** Tour dự kiến của thẻ (bán thêm) — xem + sửa ngày ngay tại đây. */
  planned?: Tour[];
  /** Bán thẻ mới: xem trước lộ trình từ DV đang chọn (ngày bắt đầu + sửa ngày) → gửi kèm `plan` khi tạo thẻ. */
  previewRoadmap?: boolean;
  onSubmit: (items: CardItemInput[], note: string, plan?: CardPlan) => Promise<boolean>;
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
  // Nhóm đã có DV (trong thẻ hoặc vừa chọn) → khoá các DV khác cùng nhóm.
  const taken = [...existing.map((i) => i.service_id), ...picked].flatMap((id) => byId.get(id) ?? []);
  const locked = (s: Service) => !picked.has(s.id) && groupTaken(s, taken);

  // Lộ trình xem trước khi bán thẻ: bước đầu = `start`, ngày sửa tay theo `${service_id}:${k}` (bước thứ k của DV).
  const [planStart, setPlanStart] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [pins, setPins] = useState<Record<string, string>>({});
  const steps = previewRoadmap ? planRoadmap(lines.flatMap((l) => {
    const s = byId.get(l.service_id);
    return s ? [{ id: s.id, service_id: s.id, sessions: l.sessions ?? 1, refunded_at: null, service: { group_id: s.group_id, tourable: s.tourable } }] : [];
  }), [], (id, k) => pins[`${id}:${k}`] ?? null, planStart) : [];
  const plan: CardPlan | undefined = steps.length ? {
    start: planStart,
    pins: Object.entries(pins).map(([key, date]) => { const [service_id, k] = key.split(":"); return { service_id, k: Number(k), date }; })
      .filter((p) => picked.has(p.service_id)),
  } : undefined;

  const close = () => { setLines([]); setNote(""); setPins({}); setPlanStart(dayjs().format("YYYY-MM-DD")); onClose(); };
  const toggle = (s: Service, on: boolean) =>
    setLines((ls) => on
      ? [...ls, { service_id: s.id, price: s.price, sessions: 1 }]
      : ls.filter((l) => l.service_id !== s.id));
  const update = (id: string, patch: Partial<CardItemInput>) =>
    setLines((ls) => ls.map((l) => (l.service_id === id ? { ...l, ...patch } : l)));
  const submit = () => {
    if (!lines.length) return void toast.error(t("needItems"));
    start(async () => {
      if (await onSubmit(lines.map((l) => ({ ...l, price: l.price ?? 0, sessions: l.sessions ?? 1 })), note, plan)) close();
    });
  };

  // Bố cục theo bề rộng drawer (container query) — mở cạnh drawer thẻ thì hẹp hơn màn hình.
  return <FormDrawer open={open} onClose={close} title={title} submitText={submitText} pending={pending} width={760} beside={beside} onSubmit={submit}>
    <div className="@container"><div className="grid gap-5 @xl:grid-cols-[minmax(0,1fr)_320px]">
      {/* Bảng giá: 1 cột chữ nhỏ, mỗi nhóm 1 khối. */}
      <div>
        {sections.map(({ group, items }) => <section key={group.id} className="mb-3">
          <h4 className="mb-1 flex items-center gap-1.5 border-b border-border pb-1 text-xs font-semibold tracking-wide text-primary uppercase">
            {group.name}
            {items.some(locked) ? <Tooltip title={t("error.sameGroup", { group: group.name })}>
              <CircleAlert className="size-3.5 cursor-help text-destructive" aria-label={t("error.sameGroup", { group: group.name })} />
            </Tooltip> : null}
          </h4>
          <ul>
            {items.map((s) => {
              const on = picked.has(s.id);
              const off = locked(s);
              return <li key={s.id}>
                <label className={`flex items-center gap-2 rounded px-1.5 py-0.5 text-xs ${off ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted"} ${on ? "bg-primary/5 font-medium" : ""}`}>
                  <Checkbox checked={on} disabled={pending || off} onChange={(e) => toggle(s, e.target.checked)} />
                  <span className="min-w-0 flex-1">{s.name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">{formatIdr(s.price)}</span>
                </label>
              </li>;
            })}
          </ul>
        </section>)}
      </div>

      {/* Đã chọn + tạm tính — dính trên khi cuộn (khi 2 cột). */}
      <Section title={t("selected", { count: lines.length })} className="self-start @xl:sticky @xl:top-0">
        {/* DV đang có trong thẻ — chỉ đọc, để thấy giá trị thẻ sau cập nhật. */}
        {existing.length ? <ul className="flex flex-col gap-1 rounded-lg border border-dashed border-border bg-muted/40 p-2.5">
          <li className="text-xs font-medium text-muted-foreground">{t("inCard")}</li>
          {existing.map((i, k) => {
            const s = byId.get(i.service_id);
            return <li key={k} className="flex items-start justify-between gap-2 text-sm text-muted-foreground">
              <div className="min-w-0">
                <div>{s?.name}</div>
                <div className="text-xs">{s ? groups.name(s.group_id) : ""}</div>
              </div>
              <div className="shrink-0 text-right text-xs tabular-nums">
                <div>{formatRupiah(i.price)}</div>
                <div>{i.sessions} {t("sessionsShort")}</div>
              </div>
            </li>;
          })}
        </ul> : null}

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
          {currentValue !== undefined ? <>
            <dt className="text-muted-foreground">{t("currentValue")}</dt><dd className="text-right">{formatRupiah(currentValue)}</dd>
            <dt className="text-muted-foreground">{t("addedValue")}</dt><dd className="text-right">+ {formatRupiah(total)}</dd>
            <dt className="font-medium">{t("valueAfter")}</dt><dd className="text-right font-semibold">{formatRupiah(currentValue + total)}</dd>
          </> : <>
            <dt className="text-muted-foreground">{t("value")}</dt><dd className="text-right font-medium">{formatRupiah(total)}</dd>
          </>}
          {deposit !== undefined ? <>
            <dt className="text-muted-foreground">{t("depositUsed")}</dt><dd className="text-right text-success">− {formatRupiah(deposit)}</dd>
            <dt className="font-medium">{due < 0 ? t("refundOwed") : t("due")}</dt>
            <dd className="text-right font-semibold text-warning">{formatRupiah(Math.abs(due))}</dd>
          </> : null}
        </dl>

        <Input.TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("note")} aria-label={t("note")}
          autoSize={{ minRows: 2, maxRows: 5 }} maxLength={2000} />

        {planned?.length ? <PlannedTours tours={planned} services={byId} /> : null}
        {steps.length ? <RoadmapList title={t("plannedTours")} hint={t("plannedPreviewHint")} rows={steps.map((step, i) => {
          const prior = steps.slice(0, i).filter((x) => x.card_item_id === step.card_item_id)
            .map((x) => ({ tour_date: x.tour_date, service_detail: x.kind }));
          return {
            key: `${step.card_item_id}:${prior.length}`, date: step.tour_date, service: byId.get(step.service_id)?.name ?? "—",
            kind: tourKindDetail(step.kind, step.tour_date, prior),
            onChange: (date: string) => i === 0 ? setPlanStart(date) : setPins((p) => ({ ...p, [`${step.card_item_id}:${prior.length}`]: date })),
          };
        })} /> : null}
      </Section>
    </div></div>
  </FormDrawer>;
}

type RoadmapRow = {
  key: string; date: string; service: string;
  kind: { service_detail: string | null; service_session: number | null };
  onChange: (date: string) => void;
};

/** Danh sách tour dự kiến: Loại + DV + ô ngày (đổi ngày → các tour sau dời theo). */
function RoadmapList({ title, hint, rows, disabled }: { title: string; hint: string; rows: RoadmapRow[]; disabled?: boolean }) {
  const tt = useTranslations("tour");
  return <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-2.5">
    <div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => <li key={row.key} className="flex items-center justify-between gap-2 text-xs">
        <div className="min-w-0">
          <div className="font-medium">{kindText(tt, row.kind as Parameters<typeof kindText>[1]) || "—"}</div>
          <div className="truncate text-muted-foreground">{row.service}</div>
        </div>
        <div className="w-36 shrink-0">
          <DatePicker allowClear={false} value={row.date}
            onChange={(v) => { if (!disabled && v && v !== row.date) row.onChange(v); }} />
        </div>
      </li>)}
    </ul>
  </div>;
}

/** Lộ trình dự kiến của thẻ: sửa ngày 1 tour → lưu cố định ngày đó, các tour dự kiến sau tự dời theo (server sync). */
function PlannedTours({ tours, services }: { tours: Tour[]; services: Map<string, Service> }) {
  const t = useTranslations("cards");
  const tt = useTranslations("tour");
  const [pending, start] = useTransition();
  const save = (id: string, date: string) => start(async () => {
    await runAction(setPlannedTourDate(id, date), tt("dateSaved"), tt("saveError"));
  });
  return <RoadmapList title={t("plannedTours")} hint={t("plannedToursHint")} disabled={pending}
    rows={[...tours].sort((a, b) => a.tour_date.localeCompare(b.tour_date)).map((tour) => ({
      key: tour.id, date: tour.tour_date, service: services.get(tour.service_id)?.name ?? "—", kind: tour,
      onChange: (date: string) => save(tour.id, date),
    }))} />;
}
