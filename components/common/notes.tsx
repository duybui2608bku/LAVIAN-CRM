"use client";

import { useId, useState, useTransition } from "react";
import { Button, Drawer, Input, Tag, Timeline } from "antd";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import dayjs from "dayjs";
import { ConfirmAction } from "@/components/common/confirm-action";
import { UserAvatar, type StaffRef } from "@/components/common/user-avatar";
import { toast } from "@/lib/toast";

/**
 * 1 ghi chú dạng timeline, dùng chung mọi nơi: ghi chú Telesales của khách (`customers.notes`)
 * và ghi chú Sales của lịch (`clinic_appointments.sales_notes`). Server stamp at / by / by_id.
 */
export type NoteEntry = {
  id?: string; // note cũ của khách không có id → không xoá được
  title?: string | null; // không bắt buộc
  text: string;
  at: string; // ISO timestamp
  by?: string | null; // tên người ghi lúc ghi
  by_id?: string | null; // profile id → tra tên/avatar hiện tại
};

/** Người ghi: tra theo id → theo tên lưu lúc ghi (note cũ) → tên thô. */
export function noteAuthor(n: NoteEntry, staff: StaffRef[]) {
  const s = (n.by_id && staff.find((x) => x.id === n.by_id)) || (n.by ? staff.find((x) => x.user_name === n.by) : undefined);
  return { name: s?.user_name || n.by || "", avatar: s?.avatar_url };
}

/** Thời gian → tiêu đề đậm → "Người ghi · nội dung". `clamp` = cắt 2 dòng (xem nhanh). */
export function NoteItem({ note, staff, clamp }: { note: NoteEntry; staff: StaffRef[]; clamp?: boolean }) {
  const author = noteAuthor(note, staff);
  return <div className="min-w-0">
    <div className="text-xs text-muted-foreground tabular-nums">{dayjs(note.at).format("DD/MM/YYYY · HH:mm")}</div>
    {note.title && <div className="mt-0.5 font-semibold">{note.title}</div>}
    <p className={`mt-0.5 break-words whitespace-pre-wrap text-muted-foreground ${clamp ? "line-clamp-2" : ""}`}>
      {author.name && <span className="font-medium text-foreground">{author.name} · </span>}{note.text}
    </p>
  </div>;
}

/** Timeline mới nhất ở trên, chấm = avatar người ghi. `onDelete` + `canDelete` → nút xoá (có hỏi lại). */
export function NoteTimeline({ notes, staff, canDelete, onDelete }: {
  notes: NoteEntry[];
  staff: StaffRef[];
  canDelete?: (n: NoteEntry) => boolean;
  onDelete?: (n: NoteEntry) => Promise<unknown>;
}) {
  const t = useTranslations("notes");
  if (!notes.length) return <p className="text-muted-foreground">{t("empty")}</p>;
  return <Timeline items={[...notes].reverse().map((n, i) => ({
    key: n.id ?? i,
    icon: <UserAvatar src={noteAuthor(n, staff).avatar} size={22} />,
    content: <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1"><NoteItem note={n} staff={staff} /></div>
      {onDelete && canDelete?.(n) && <ConfirmAction title={t("deleteConfirm")} onConfirm={() => onDelete(n)}>
        <Button type="text" size="small" aria-label={t("delete")} title={t("delete")} className="text-muted-foreground"
          icon={<Trash2 className="size-4" />} />
      </ConfirmAction>}
    </div>,
  }))} />;
}

/** Ô soạn ghi chú: chip tiêu đề gợi ý (hoặc tự gõ, bỏ trống được) + nội dung, Ctrl/⌘ + Enter lưu. */
export function NoteComposer({ onAdd, suggestions }: {
  onAdd: (input: { title: string; text: string }) => Promise<{ error?: string }>;
  /** Tiêu đề gợi ý, ngăn cách "|" — mặc định `notes.suggestions`. */
  suggestions?: string;
}) {
  const t = useTranslations("notes");
  const id = useId();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    if (!text.trim()) return;
    const res = await onAdd({ title, text });
    if (res.error) return void toast.error(res.error);
    toast.success(t("added"));
    setTitle("");
    setText("");
  });

  // 2 phần tách rõ: Tiêu đề (tuỳ chọn, chip gợi ý ngay dưới) → Nội dung (bắt buộc) → hàng nút.
  return <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/40 p-4">
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-title`} className="text-sm font-medium">
        {t("titleLabel")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
      </label>
      <Input id={`${id}-title`} value={title} maxLength={120} allowClear placeholder={t("titlePlaceholder")}
        onChange={(e) => setTitle(e.target.value)} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{t("suggest")}</span>
        {(suggestions ?? t("suggestions")).split("|").map((s) => <Tag.CheckableTag key={s} checked={title === s}
          className="me-0 border border-border" onChange={(on) => setTitle(on ? s : "")}>{s}</Tag.CheckableTag>)}
      </div>
    </div>
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-text`} className="text-sm font-medium">
        {t("textLabel")} <span className="text-destructive" aria-hidden>*</span>
      </label>
      <Input.TextArea id={`${id}-text`} value={text} autoFocus maxLength={10000} autoSize={{ minRows: 4, maxRows: 10 }}
        placeholder={t("textPlaceholder")} aria-required onChange={(e) => setText(e.target.value)}
        onPressEnter={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); save(); } }} />
    </div>
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground max-sm:hidden">{t("shortcut")}</span>
      <Button type="primary" className="ms-auto" loading={pending} disabled={!text.trim()} onClick={save}>{t("add")}</Button>
    </div>
  </div>;
}

/** Drawer ghi chú dùng chung: ô soạn (khi có `onAdd`) ở trên, timeline bên dưới. */
export function NotesDrawer({ open, title, notes, staff, onAdd, canDelete, onDelete, onClose }: {
  open: boolean;
  title: React.ReactNode;
  notes: NoteEntry[];
  staff: StaffRef[];
  /** Không truyền = chỉ xem. */
  onAdd?: (input: { title: string; text: string }) => Promise<{ error?: string }>;
  canDelete?: (n: NoteEntry) => boolean;
  onDelete?: (n: NoteEntry) => Promise<{ error?: string }>;
  onClose: () => void;
}) {
  const t = useTranslations("notes");
  const remove = onDelete && (async (n: NoteEntry) => {
    const res = await onDelete(n);
    if (res.error) toast.error(res.error);
    else toast.success(t("deleted"));
  });
  return <Drawer open={open} onClose={onClose} size={520} destroyOnHidden title={title}>
    {onAdd && <NoteComposer onAdd={onAdd} />}
    <h3 className="mt-5 mb-3 font-semibold">{t("history")} <span className="font-normal text-muted-foreground">({notes.length})</span></h3>
    <NoteTimeline notes={notes} staff={staff} canDelete={canDelete} onDelete={remove} />
  </Drawer>;
}

/** Ô bảng: ghi chú gần nhất (thời gian · +N, tiêu đề, nội dung 2 dòng); `contentOnly` = chỉ nội dung. Bấm mở drawer. */
export function NoteCell({ notes, contentOnly, emptyText, label, onOpen }: {
  notes: NoteEntry[];
  contentOnly?: boolean;
  emptyText: string;
  label: string;
  onOpen: () => void;
}) {
  const last = notes.at(-1);
  return <button type="button" aria-label={label}
    className="block w-full cursor-pointer rounded text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
    title={contentOnly ? notes.map((n) => n.text).join("\n\n") : undefined} onClick={onOpen}>
    {last ? <div className="leading-tight">
      {!contentOnly && <div className="text-xs text-muted-foreground tabular-nums">
        {dayjs(last.at).format("DD/MM/YYYY HH:mm")}{notes.length > 1 && ` · +${notes.length - 1}`}
      </div>}
      {!contentOnly && last.title && <div className="mt-0.5 truncate font-medium">{last.title}</div>}
      <div className={`line-clamp-2 whitespace-pre-wrap ${contentOnly ? "" : "mt-0.5"}`}>{last.text}</div>
    </div> : <span className="text-muted-foreground">{emptyText}</span>}
  </button>;
}
