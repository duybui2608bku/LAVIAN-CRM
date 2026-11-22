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
import { mergeTimeline } from "@/lib/customer-360";
import { toast } from "@/lib/toast";
import type { AppointmentLog, AppointmentLogField } from "@/types/appointment";
import type { Customer360 } from "@/types/customer-360";
import { useServiceGroups } from "@/components/common/service-groups";

// ─────────────────────────── Ảnh B/A (chỉ xem, gom theo lịch) ───────────────────────────

export function PhotosTab({ data }: { data: Customer360 }) {
  const sg = useServiceGroups();
  const t = useTranslations("c360.photos");
  const photos = data.photos ?? [];
  const groups = data.appointments.filter((a) => photos.some((p) => p.appointment_id === a.id));
  if (!groups.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("empty")} />;
  return <Image.PreviewGroup>
    <div className="flex flex-col gap-4">
      {groups.map((a) => {
        const services = a.service_ids.map((id) => data.services.find((s) => s.id === id)).filter((s) => !!s)
          .map((s) => s.name).join(", ") || sg.label(a.service_categories);
        return <Section key={a.id} title={[dayjs(a.scheduled_at).format("DD/MM"), services].filter(Boolean).join(" · ")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["before", "after"] as const).map((kind) => <div key={kind}>
              <div className="mb-1 text-xs text-muted-foreground">{t(kind)}</div>
              <div className="flex flex-wrap gap-2">
                {photos.filter((p) => p.appointment_id === a.id && p.kind === kind).map((p) =>
                  <Image key={p.id} src={p.url} alt={t(kind)} width={120} height={120} className="rounded-lg object-cover" />)}
              </div>
            </div>)}
          </div>
        </Section>;
      })}
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

const KINDS = ["log", "customer_note", "appointment_note", "sales_note"] as const;
type Kind = (typeof KINDS)[number];
const LOG_FIELDS: AppointmentLogField[] = ["scheduled_at", "booking_confirm", "visit_status", "service_categories", "service_ids",
  "staff_id", "sales_id", "technician_id", "bill_amount", "paid_amount", "note", "sales_note"];

export function TimelineTab({ data, staff, composing, onSaved }: {
  data: Customer360; staff: StaffRef[]; composing: boolean; onSaved: () => void;
}) {
  const t = useTranslations("c360");
  const th = useTranslations("customers.apptHistory");
  const [filter, setFilter] = useState<Kind | "all">("all");

  const items = mergeTimeline<Kind, { at: string; key: string; node: React.ReactNode; by_id?: string | null }>([
    { kind: "log", items: data.logs.map((l: AppointmentLog) => ({
      at: l.created_at, key: l.id, by_id: l.actor_id,
      node: <div className="text-sm">
        <div className="text-xs text-muted-foreground tabular-nums">
          {dayjs(l.created_at).format("DD/MM/YYYY · HH:mm")} · {l.actor_id ? staff.find((s) => s.id === l.actor_id)?.user_name ?? "—" : th("systemActor")}
        </div>
        <p className="mt-0.5">
          <span className="font-medium">{th(`action.${l.action}`)}</span>
          {l.appointment && <span className="tabular-nums"> {dayjs(l.appointment.scheduled_at).format("DD/MM HH:mm")}</span>}
          {l.action === "update" && <span className="text-muted-foreground"> · {LOG_FIELDS.filter((f) => f in l.changes).map((f) => th(`field.${f}`)).join(", ")}</span>}
        </p>
      </div>,
    })) },
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
