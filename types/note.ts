/**
 * 1 ghi chú dạng timeline (cột jsonb mảng): clinic_appointments.notes / sales_notes, tours.notes.
 * Server stamp id, at, by, by_id (không tin client). Ghi chú khách (customers.notes) cùng dạng, id/title tuỳ chọn.
 */
export interface TimelineNote {
  id: string;
  title: string | null; // không bắt buộc
  text: string;
  at: string; // ISO timestamp
  by: string | null; // tên người ghi lúc ghi — ghi chú chuyển từ cột note cũ không có
  by_id: string | null; // profile id → tra tên/avatar hiện tại
}

export type NoteInput = { title: string; text: string };
