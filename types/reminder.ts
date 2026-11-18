export type Reminder = {
  id: string;
  customer_id: string;
  remind_at: string;
  note: string;
  done_at: string | null;
  created_by: string | null;
  created_at: string;
};

/**
 * Khách gắn kèm lịch nhắc (tên, SĐT, link hội thoại). `staff_id` = Telesales phụ trách khách —
 * người duy nhất nhận thông báo của lịch nhắc (không chọn người phụ trách riêng).
 */
export type ReminderCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  thread: { link?: string | null } | null;
  staff_id: string | null;
};

export type ReminderWithCustomer = Reminder & { customer: ReminderCustomer | null };

export type ReminderInput = Pick<Reminder, "remind_at" | "note">;

/** Trạng thái hiển thị: quá hạn (đỏ) / hôm nay (cam) / sắp tới (xanh) / đã xong (xám). */
export type ReminderState = "overdue" | "today" | "upcoming" | "done";
