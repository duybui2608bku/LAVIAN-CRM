"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Empty, Image, Input, Segmented, Spin, Timeline } from "antd";
import { RefreshCw, Search, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dayjs from "dayjs";
import { addQuickNote, summarizeCustomerChat } from "@/app/(app)/customers/customer-360-actions";
import { ChatBubbles } from "@/components/appointments/chat-bubbles";
import { StatusTag } from "@/components/common/cells";
import { NoteComposer, NoteItem } from "@/components/common/notes";
import { Section } from "@/components/common/section";
import { UserAvatar, type StaffRef } from "@/components/common/user-avatar";
import { useCustomerMessages } from "@/components/customers/customer-360/use-customer-messages";
import { kindText } from "@/components/tour/tour-drawer";
import { formatRupiah } from "@/lib/currency";
import { mergeTimeline } from "@/lib/customer-360";
import { toast } from "@/lib/toast";
import type { AppointmentLog, AppointmentLogField } from "@/types/appointment";
import type { Customer360 } from "@/types/customer-360";
import { useServiceGroups } from "@/components/common/service-groups";

// ─────────────────────────── Ảnh B/A (chỉ xem): ảnh tour + ảnh cũ gắn lịch hẹn, mới nhất trước ───────────────────────────

type PhotoGroup = { key: string; at: string; title: string; kinds: [string, string[]][] };

export function PhotosTab({ data }: { data: Customer360 }) {
  const sg = useServiceGroups();
  const t = useTranslations("c360.photos");
  const tt = useTranslations("tour");
  const photos = data.photos ?? [];
  const serviceName = (id: string) => data.services.find((s) => s.id === id)?.name;
  const groups: PhotoGroup[] = [
    ...data.tours.map((r) => ({
      key: r.id, at: r.tour_date,
      title: [dayjs(r.tour_date).format("DD/MM/YYYY"), serviceName(r.service_id), kindText(tt, r)].filter(Boolean).join(" · "),
      kinds: [[tt("beforePhotos"), r.before_images ?? []], [tt("afterPhotos"), r.after_images ?? []], [tt("extraPhotos"), r.extra_images ?? []]] as [string, string[]][],
    })),
    ...data.appointments.map((a) => {
      const urls = (kind: "before" | "after") => photos.filter((p) => p.appointment_id === a.id && p.kind === kind).map((p) => p.url);
      const services = a.service_ids.map(serviceName).filter(Boolean).join(", ") || sg.label(a.service_categories);
      return {
        key: a.id, at: a.scheduled_at, title: [dayjs(a.scheduled_at).format("DD/MM/YYYY"), services].filter(Boolean).join(" · "),
        kinds: [[t("before"), urls("before")], [t("after"), urls("after")]] as [string, string[]][],
      };
    }),
  ].map((g) => ({ ...g, kinds: g.kinds.filter(([, urls]) => urls.length) })).filter((g) => g.kinds.length)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (!groups.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("empty")} />;
  return <Image.PreviewGroup>
    <div className="flex flex-col gap-4">
      {groups.map((g) => <Section key={g.key} title={g.title}>
        <div className="grid gap-3 sm:grid-cols-3">
          {g.kinds.map(([label, urls]) => <div key={label}>
            <div className="mb-1 text-xs text-muted-foreground">{label}</div>
            <div className="flex flex-wrap gap-2">
              {urls.map((url) => <Image key={url} src={url} alt={label} width={96} height={96} className="rounded-lg object-cover" />)}
            </div>
          </div>)}
        </div>
      </Section>)}
    </div>
  </Image.PreviewGroup>;
}

// ─────────────────────────── Hội thoại (30 tin SMAX + tìm) ───────────────────────────

export function MessagesTab({ data, staff, onSaved }: { data: Customer360; staff: StaffRef[]; onSaved: () => Promise<void> }) {
  const t = useTranslations("c360.messages");
  const ta = useTranslations("appointments");
  const [query, setQuery] = useState("");
  const live = useCustomerMessages(data.customer.thread_link ? data.customer.id : null);
  // SMAX lỗi → dùng bản chụp lúc gửi lead-form (nếu có).
  const fallback = live.error && data.smax_messages?.length ? data.smax_messages : null;
  const messages = live.data ?? fallback ?? [];
  const q = query.trim().toLowerCase();
  const shown = q ? messages.filter((m) => m.text.toLowerCase().includes(q)) : messages;

  if (!data.customer.thread_link && !data.smax_messages?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={ta("noMessages")} />;
  // Desktop: khung chat lấp đầy vùng tab (cuộn riêng); điện thoại: giới hạn 60vh.
  return <div className="flex h-full flex-col gap-3">
    <ChatSummaryBox data={data} staff={staff} latestAt={messages.at(-1)?.at} onSaved={onSaved} />
    {live.isLoading ? <div className="flex h-40 items-center justify-center"><Spin /></div> : <>
      {live.error && (fallback
        ? <Alert type="warning" showIcon title={t("snapshot", { at: dayjs(data.customer.smax_messages_at).format("DD/MM/YYYY HH:mm") })} />
        : <Alert type="error" showIcon title={live.error.message} />)}
      <Input allowClear value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")}
        prefix={<Search className="size-4" />} />
      {shown.length ? <ChatBubbles key={q} messages={shown} className="rounded-lg max-lg:max-h-[60vh] lg:max-h-none lg:min-h-0 lg:flex-1" />
        : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={q ? t("noMatch") : ta("noMessages")} />}
    </>}
  </div>;
}

/** Tóm tắt AI (Claude) hội thoại — đọc bản đã lưu; bấm mới gọi AI (ghi đè bản cũ). */
function ChatSummaryBox({ data, staff, latestAt, onSaved }: {
  data: Customer360; staff: StaffRef[]; latestAt: string | undefined; onSaved: () => Promise<void>;
}) {
  const t = useTranslations("c360.messages.ai");
  const locale = useLocale();
  const [pending, start] = useTransition();
  // Song ngữ: mặc định theo giao diện (vi → VI, còn lại → EN). Bản cũ chưa có EN thì không hiện nút chuyển.
  const [lang, setLang] = useState<"vi" | "en">(locale === "vi" ? "vi" : "en");
  const s = data.chat_summary;
  // Có tin mới hơn tin cuối đã tóm tắt → bản tóm tắt đã cũ.
  const stale = !!(s && latestAt && (!s.last_message_at || Date.parse(latestAt) > Date.parse(s.last_message_at)));
  const run = () => start(async () => {
    const res = await summarizeCustomerChat(data.customer.id);
    if (res.error) return void toast.error(res.error);
    await onSaved();
  });

  return <Section className="shrink-0"
    title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-primary" aria-hidden />{t("title")}</span>}
    extra={<div className="flex flex-wrap items-center gap-2">
      {stale && <StatusTag color="orange" label={t("stale")} />}
      {s?.summary_en && <Segmented size="small" value={lang} onChange={setLang}
        options={[{ value: "vi", label: "VI" }, { value: "en", label: "EN" }]} aria-label={t("language")} />}
      <Button size="small" loading={pending} onClick={run}
        icon={s ? <RefreshCw className="size-3.5" /> : <Sparkles className="size-3.5" />}>{t(s ? "again" : "run")}</Button>
    </div>}>
    <div className="flex flex-col gap-2" aria-busy={pending}>
      {pending ? <p className="text-sm text-muted-foreground">{t("working")}</p>
        : s ? <>
          <p className="max-h-40 overflow-y-auto text-sm whitespace-pre-wrap" lang={lang === "en" && s.summary_en ? "en" : "vi"}>
            {lang === "en" && s.summary_en ? s.summary_en : s.summary}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{t("meta", {
            at: dayjs(s.created_at).format("DD/MM/YYYY HH:mm"), count: s.message_count,
            name: staff.find((m) => m.id === s.created_by)?.user_name ?? "—",
          })}</p>
        </>
        : <p className="text-sm text-muted-foreground">{t("empty")}</p>}
    </div>
  </Section>;
}

// ─────────────────────────── Lịch sử & Ghi chú ───────────────────────────

const KINDS = ["log", "card", "tour", "customer_note", "appointment_note", "sales_note"] as const;
type Kind = (typeof KINDS)[number];
const LOG_FIELDS: AppointmentLogField[] = ["scheduled_at", "booking_confirm", "visit_status", "service_categories", "service_ids",
  "staff_id", "sales_id", "technician_id", "bill_amount", "paid_amount", "note", "sales_note"];

export function TimelineTab({ data, staff, composing, onSaved }: {
  data: Customer360; staff: StaffRef[]; composing: boolean; onSaved: () => void;
}) {
  const t = useTranslations("c360");
  const th = useTranslations("customers.apptHistory");
  const tc = useTranslations("cards");
  const tt = useTranslations("tour");
  const [filter, setFilter] = useState<Kind | "all">("all");
  const who = (id: string | null | undefined) => (id && staff.find((s) => s.id === id)?.user_name) || "—";
  const serviceName = (id: string) => data.services.find((s) => s.id === id)?.name;
  // 1 mục: dòng phụ "ngày · người", dòng chính nội dung.
  const entry = (at: string, by: string, body: React.ReactNode, f = "DD/MM/YYYY · HH:mm") => <div className="text-sm">
    <div className="text-xs text-muted-foreground tabular-nums">{dayjs(at).format(f)} · {by}</div>
    <p className="mt-0.5">{body}</p>
  </div>;

  const items = mergeTimeline<Kind, { at: string; key: string; node: React.ReactNode; by_id?: string | null }>([
    { kind: "log", items: data.logs.map((l: AppointmentLog) => ({
      at: l.created_at, key: l.id, by_id: l.actor_id,
      node: entry(l.created_at, l.actor_id ? who(l.actor_id) : th("systemActor"), <>
        <span className="font-medium">{th(`action.${l.action}`)}</span>
        {l.appointment && <span className="tabular-nums"> {dayjs(l.appointment.scheduled_at).format("DD/MM HH:mm")}</span>}
        {l.action === "update" && <span className="text-muted-foreground"> · {LOG_FIELDS.filter((f) => f in l.changes).map((f) => th(`field.${f}`)).join(", ")}</span>}
      </>),
    })) },
    // Thẻ liệu trình: bán thẻ + từng lần thu / hoàn (thanh toán chỉ có khi được xem tài chính).
    { kind: "card", items: data.cards.flatMap((c) => [
      { at: c.created_at, key: c.id, by_id: c.created_by, node: entry(c.created_at, who(c.created_by), <>
        <span className="font-medium">{t("timeline.cardSold", { code: c.code })}</span>
        <span className="text-muted-foreground"> · {c.items.map((i) => serviceName(i.service_id)).filter(Boolean).join(", ")}</span>
        {c.cancelled_at && <span className="text-destructive"> · {tc("status.cancelled")}</span>}
      </>) },
      ...(c.payments ?? []).map((p) => ({ at: p.paid_at, key: p.id, by_id: p.created_by, node: entry(p.paid_at, who(p.created_by), <>
        <span className="font-medium">{t(p.amount < 0 ? "timeline.refund" : "timeline.payment", { code: c.code })}</span>
        <span className="tabular-nums"> {formatRupiah(Math.abs(p.amount))}</span>
        <span className="text-muted-foreground"> · {tc(`method.${p.method}`)}</span>
      </>) })),
    ]) },
    { kind: "tour", items: data.tours.map((r) => ({ at: r.tour_date, key: r.id, by_id: r.technician_id, node: entry(r.tour_date, who(r.technician_id), <>
      <span className="font-medium">{tt("title")}</span>
      <span className="text-muted-foreground"> · {[serviceName(r.service_id), kindText(tt, r)].filter(Boolean).join(" · ")}</span>
      {r.confirmed_at && <span className="text-success"> · {tt("status_confirmed")}</span>}
    </>, "DD/MM/YYYY") })) },
    { kind: "customer_note", items: data.customer.notes.map((n, i) => ({ at: n.at, key: n.id ?? `c${i}`, by_id: n.by_id, node: <NoteItem note={n} staff={staff} /> })) },
    { kind: "appointment_note", items: data.appointments.flatMap((a) => a.notes.map((n) => ({ at: n.at, key: n.id, by_id: n.by_id, node: <NoteItem note={n} staff={staff} /> }))) },
    { kind: "sales_note", items: data.appointments.flatMap((a) => a.sales_notes.map((n) => ({ at: n.at, key: n.id, by_id: n.by_id, node: <NoteItem note={n} staff={staff} /> }))) },
  ]);
  const shown = filter === "all" ? items : items.filter((i) => i.kind === filter);

  return <div className="flex flex-col gap-4">
    {composing && <NoteComposer suggestions={t("noteSuggestions")} onAdd={async (input) => {
      const res = await addQuickNote(data.customer.id, input);
      if (!res.error) onSaved();
      return res;
    }} />}
    <Segmented value={filter} onChange={(v) => setFilter(v as Kind | "all")} className="self-start max-sm:w-full max-sm:overflow-x-auto"
      options={[{ value: "all", label: t("timeline.all") }, ...KINDS.map((k) => ({ value: k, label: t(`timeline.${k}`) }))]} />
    {shown.length ? <Timeline items={shown.map((i) => ({
      key: `${i.kind}-${i.key}`,
      icon: <UserAvatar src={staff.find((s) => s.id === i.by_id)?.avatar_url} size={22} />,
      content: i.node,
    }))} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("timeline.empty")} />}
  </div>;
}
