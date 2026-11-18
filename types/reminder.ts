export type Reminder = {
  id: string;
  customer_id: string;
  assignee_id: string | null;
  remind_at: string;
  note: string;
  done_at: string | null;
  created_by: string | null;
  created_at: string;
};

/** Khách gắn kèm lịch nhắc (trang calendar cần tên, SĐT, link hội thoại). */
export type ReminderCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  thread: { link?: string | null } | null;
};

export type ReminderWithCustomer = Reminder & { customer: ReminderCustomer | null };

export type ReminderInput = Pick<Reminder, "assignee_id" | "remind_at" | "note">;

/** Trạng thái hiển thị: quá hạn (đỏ) / hôm nay (cam) / sắp tới (xanh) / đã xong (xám). */
export type ReminderState = "overdue" | "today" | "upcoming" | "done";
