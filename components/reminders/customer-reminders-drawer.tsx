"use client";

import { useState } from "react";
import { Button, Drawer, Empty } from "antd";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";
import { BellPlus } from "lucide-react";

import type { StaffRef } from "@/components/common/user-avatar";
import { ReminderFormModal } from "@/components/reminders/reminder-form-modal";
import { ReminderItem } from "@/components/reminders/reminder-item";
import { suggestRemindAt } from "@/lib/reminders";
import type { Reminder, ReminderCustomer, ReminderInput } from "@/types/reminder";

export type ReminderTarget = ReminderCustomer;

/** Tin nhắn mẫu: có lịch hẹn sắp tới thì kèm giờ hẹn. */
export function useDefaultReminder() {
  const t = useTranslations("reminders");
  return (customer: ReminderTarget, appointmentAt: string | undefined, now: number): ReminderInput => ({
    remind_at: suggestRemindAt(appointmentAt, now),
    note:
      appointmentAt && Date.parse(appointmentAt) > now
        ? t("defaultMessage", { name: customer.full_name, time: dayjs(appointmentAt).format("HH:mm DD-MM-YYYY") })
        : t("defaultMessageNoTime", { name: customer.full_name }),
  });
}

/** Drawer cột Nhắc hẹn (Booking management): mọi lịch nhắc của 1 khách + thêm/sửa. */
export function CustomerRemindersDrawer({
  customer,
  reminders,
  staff,
  appointmentAt,
  now,
  canEdit,
  onClose,
}: {
  customer: ReminderTarget | null;
  reminders: Reminder[];
  staff: StaffRef[];
  /** Lịch hẹn sắp tới của khách — gợi ý giờ nhắc + tin nhắn mẫu. */
  appointmentAt?: string;
  now: number;
  canEdit: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("reminders");
  const defaultFor = useDefaultReminder();
  // null = đóng modal; "new" = thêm; Reminder = sửa.
  const [editing, setEditing] = useState<Reminder | "new" | null>(null);
  // Chưa xong lên trước (sớm nhất trước), đã xong xuống cuối (mới nhất trước).
  const list = [...reminders].sort((a, b) =>
    !!a.done_at !== !!b.done_at
      ? a.done_at ? 1 : -1
      : a.done_at ? Date.parse(b.remind_at) - Date.parse(a.remind_at) : Date.parse(a.remind_at) - Date.parse(b.remind_at),
  );

  return (
    <Drawer
      open={!!customer}
      onClose={onClose}
      size={480}
      title={customer ? `${t("title")} · ${customer.full_name}` : t("title")}
      extra={
        canEdit && (
          <Button type="primary" icon={<BellPlus className="size-4" />} onClick={() => setEditing("new")}>
            {t("add")}
          </Button>
        )
      }
    >
      {list.length ? (
        <div className="space-y-2">
          {list.map((r) => (
            <ReminderItem
              key={r.id}
              reminder={r}
              customer={customer}
              showCustomer={false}
              staff={staff}
              now={now}
              timeFormat="DD-MM-YYYY HH:mm"
              canEdit={canEdit}
              onEdit={() => setEditing(r)}
            />
          ))}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("empty")} />
      )}
      {customer && editing && (
        <ReminderFormModal
          open
          customerId={customer.id}
          customerName={customer.full_name}
          customerStaffId={customer.staff_id}
          editing={editing === "new" ? null : editing}
          defaults={defaultFor(customer, appointmentAt, now)}
          staff={staff}
          onClose={() => setEditing(null)}
        />
      )}
    </Drawer>
  );
}
