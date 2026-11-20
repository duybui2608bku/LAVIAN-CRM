import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { NoteInput, TimelineNote } from "@/types/note";

const noteInputSchema = z.object({
  title: z.string().trim().max(120).transform((v) => v || null),
  text: z.string().trim().min(1).max(10000),
}).strict();

/** Ghi chú mới từ input của client — server stamp id, thời gian, người ghi. */
export function newNote(input: NoteInput, author: { id: string; user_name?: string | null; email?: string | null }): TimelineNote {
  return {
    id: crypto.randomUUID(), ...noteInputSchema.parse(input), at: new Date().toISOString(),
    by: author.user_name || author.email || null, by_id: author.id,
  };
}

/** Ô ghi chú ở form tạo (lịch hẹn, tour) → ghi chú đầu tiên của timeline (trống = không có). */
export const initialNotes = (text: string | undefined, author: Parameters<typeof newNote>[1]) =>
  text?.trim() ? [newNote({ title: "", text }, author)] : [];

/** Bỏ 1 ghi chú — chỉ người ghi hoặc admin. Không thấy ghi chú → null (không cần ghi). */
export function withoutNote(notes: TimelineNote[], noteId: string, profile: { id: string; role: string }) {
  const target = notes.find((n) => n.id === noteId);
  if (!target) return null;
  if (target.by_id !== profile.id && profile.role !== "admin") {
    throw new AppError("Chỉ người ghi được xoá ghi chú này.", { code: "FORBIDDEN", status: 403 });
  }
  return notes.filter((n) => n.id !== noteId);
}
