"use client";

import { useState, useTransition } from "react";
import { Button, Drawer, Input, Tag, Timeline } from "antd";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { addSalesNote, deleteSalesNote } from "@/app/(app)/appointments/actions";
import { ConfirmAction } from "@/components/common/confirm-action";
import { useCurrentUserId } from "@/components/common/permissions";
import { UserAvatar, type StaffRef } from "@/components/common/user-avatar";
import { toast } from "@/lib/toast";
import type { Appointment, SalesNote } from "@/types/appointment";

/** Người ghi: tra theo id (tên/avatar hiện tại) → tên lưu lúc ghi. */
export function noteAuthor(n: SalesNote, staff: StaffRef[]) {
  const s = n.by_id ? staff.find((x) => x.id === n.by_id) : undefined;
  return { name: s?.user_name || n.by || "", avatar: s?.avatar_url };
}

/** 1 dòng timeline: thời gian → tiêu đề đậm → "Người ghi · nội dung" (như timeline lịch sử khách). */
export function SalesNoteItem({ note, staff, clamp }: { note: SalesNote; staff: StaffRef[]; clamp?: boolean }) {
  const author = noteAuthor(note, staff);
  return <div className="min-w-0">
    <div className="text-xs text-muted-foreground tabular-nums">{dayjs(note.at).format("DD/MM/YYYY · HH:mm")}</div>
    {note.title && <div className="mt-0.5 font-semibold">{note.title}</div>}
    <p className={`mt-0.5 break-words whitespace-pre-wrap text-muted-foreground ${clamp ? "line-clamp-2" : ""}`}>
      {author.name && <span className="font-medium text-foreground">{author.name} · </span>}{note.text}
    </p>
  </div>;
}

/** Drawer Ghi chú Sales của 1 lịch: ô soạn (chip tiêu đề gợi ý, Ctrl+Enter) ở trên, timeline mới nhất ở trên. */
export function SalesNotesDrawer({ appointment, customerName, staff, canEdit, onClose }: {
  appointment: Appointment | null;
  customerName: string;
  staff: StaffRef[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("appointments");
  const me = useCurrentUserId();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const notes = [...(appointment?.sales_notes ?? [])].reverse();
  const suggestions = t("noteTitles").split("|");

  const save = () => start(async () => {
    if (!appointment || !text.trim()) return;
    const res = await addSalesNote(appointment.id, { title, text });
    if (res.error) return void toast.error(res.error);
    toast.success(t("noteAdded"));
    setTitle("");
    setText("");
  });

  const remove = async (noteId: string) => {
    if (!appointment) return;
    const res = await deleteSalesNote(appointment.id, noteId);
    if (res.error) toast.error(res.error);
    else toast.success(t("noteDeleted"));
  };

  return <Drawer open={appointment !== null} onClose={onClose} size={520} destroyOnHidden
    title={t("salesNotesTitle", { name: customerName })}>
    {canEdit && <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {suggestions.map((s) => <Tag.CheckableTag key={s} checked={title === s} className="me-0"
          onChange={(on) => setTitle(on ? s : "")}>{s}</Tag.CheckableTag>)}
      </div>
      <Input value={title} maxLength={120} allowClear placeholder={t("noteTitle")} aria-label={t("noteTitle")}
        variant="borderless" className="px-0 font-semibold" onChange={(e) => setTitle(e.target.value)} />
      <Input.TextArea value={text} autoFocus maxLength={10000} autoSize={{ minRows: 3, maxRows: 10 }}
        variant="borderless" className="px-0" placeholder={t("noteText")} aria-label={t("noteText")}
        onChange={(e) => setText(e.target.value)}
        onPressEnter={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); save(); } }} />
      <div className="mt-2 flex justify-end">
        <Button type="primary" loading={pending} disabled={!text.trim()} onClick={save}>{t("addNote")}</Button>
      </div>
    </div>}

    <h3 className="mt-5 mb-3 font-semibold">{t("notesHistory")} <span className="font-normal text-muted-foreground">({notes.length})</span></h3>
    {notes.length ? <Timeline items={notes.map((n) => ({
      key: n.id,
      icon: <UserAvatar src={noteAuthor(n, staff).avatar} size={22} />,
      content: <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1"><SalesNoteItem note={n} staff={staff} /></div>
        {canEdit && n.by_id === me && <ConfirmAction title={t("deleteNoteConfirm")} onConfirm={() => remove(n.id)}>
          <Button type="text" size="small" aria-label={t("deleteNote")} title={t("deleteNote")}
            className="text-muted-foreground"
            icon={<Trash2 className="size-4" />} />
        </ConfirmAction>}
      </div>,
    }))} /> : <p className="text-muted-foreground">{t("notesEmpty")}</p>}
  </Drawer>;
}
