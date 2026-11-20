"use client";

import { useState } from "react";
import { Alert, Empty, Image, Input, Segmented, Spin, Tag, Timeline } from "antd";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dayjs from "dayjs";
import { addQuickNote } from "@/app/(app)/customers/customer-360-actions";
import { ChatBubbles } from "@/components/appointments/chat-bubbles";
import { NoteComposer, NoteItem } from "@/components/common/notes";
import { UserAvatar, type StaffRef } from "@/components/common/user-avatar";
import { useCustomerMessages } from "@/components/customers/customer-360/use-customer-messages";
import { mergeTimeline } from "@/lib/customer-360";
import { serviceName } from "@/lib/customers";
import type { AppointmentLog, AppointmentLogField } from "@/types/appointment";
import type { Customer360 } from "@/types/customer-360";
import { serviceCategoriesLabel } from "@/types/service";

// ─────────────────────────── Ảnh B/A (chỉ xem, gom theo lịch) ───────────────────────────

export function PhotosTab({ data }: { data: Customer360 }) {
  const t = useTranslations("c360.photos");
  const locale = useLocale();
  const photos = data.photos ?? [];
  const groups = data.appointments.filter((a) => photos.some((p) => p.appointment_id === a.id));
  if (!groups.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("empty")} />;
  return <Image.PreviewGroup>
    <div className="flex flex-col gap-4">
      {groups.map((a) => {
        const services = a.service_ids.map((id) => data.services.find((s) => s.id === id)).filter((s) => !!s)
          .map((s) => serviceName(s, locale)).join(", ") || serviceCategoriesLabel(a.service_categories);
        return <section key={a.id}>
          <h3 className="mb-2 font-semibold tabular-nums">{[dayjs(a.scheduled_at).format("DD/MM"), services].filter(Boolean).join(" · ")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["before", "after"] as const).map((kind) => <div key={kind}>
              <div className="mb-1 text-xs text-muted-foreground">{t(kind)}</div>
              <div className="flex flex-wrap gap-2">
                {photos.filter((p) => p.appointment_id === a.id && p.kind === kind).map((p) =>
                  <Image key={p.id} src={p.url} alt={t(kind)} width={120} height={120} className="rounded-lg object-cover" />)}
              </div>
            </div>)}
          </div>
        </section>;
      })}
    </div>
  </Image.PreviewGroup>;
}

// ─────────────────────────── Hội thoại (30 tin SMAX + tìm) ───────────────────────────

export function MessagesTab({ data }: { data: Customer360 }) {
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
  if (live.isLoading) return <div className="flex h-40 items-center justify-center"><Spin /></div>;
  // Desktop: khung chat lấp đầy vùng tab (cuộn riêng); điện thoại: giới hạn 60vh.
  return <div className="flex h-full flex-col gap-3">
    {live.error && (fallback
      ? <Alert type="warning" showIcon title={t("snapshot", { at: dayjs(data.customer.smax_messages_at).format("DD/MM/YYYY HH:mm") })} />
      : <Alert type="error" showIcon title={live.error.message} />)}
    <Input allowClear value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")}
      prefix={<Search className="size-4" />} />
    {shown.length ? <ChatBubbles key={q} messages={shown} className="rounded-lg max-lg:max-h-[60vh] lg:max-h-none lg:min-h-0 lg:flex-1" />
      : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={q ? t("noMatch") : ta("noMessages")} />}
  </div>;
}

// ─────────────────────────── Lịch sử & Ghi chú ───────────────────────────

const KINDS = ["log", "customer_note", "appointment_note", "sales_note"] as const;
type Kind = (typeof KINDS)[number];
const KIND_COLORS: Record<Kind, string> = { log: "default", customer_note: "blue", appointment_note: "cyan", sales_note: "purple" };
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
      content: <div className="flex flex-col gap-1">
        <Tag color={KIND_COLORS[i.kind]} className="me-0 self-start text-xs">{t(`timeline.${i.kind}`)}</Tag>
        {i.node}
      </div>,
    }))} /> : <p className="text-sm text-muted-foreground">{t("timeline.empty")}</p>}
  </div>;
}
