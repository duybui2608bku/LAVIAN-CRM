"use client";

import { useState, useTransition } from "react";
import { Button, Empty, Form, Input, Popover } from "antd";
import { useTranslations } from "next-intl";
import { BellRing } from "lucide-react";

import { createReminder, updateReminder } from "@/app/(app)/customers/reminders/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { customerTelesales } from "@/components/reminders/reminder-form-modal";
import { ReminderItem } from "@/components/reminders/reminder-item";
import { suggestRemindAt } from "@/lib/reminders";
import { toast } from "@/lib/toast";
import type { Reminder, ReminderCustomer, ReminderInput } from "@/types/reminder";

type Props = {
  customer: ReminderCustomer;
  reminders: Reminder[];
  staff: StaffRef[];
  /** Lịch hẹn sắp tới của khách — gợi ý giờ nhắc (9:00 trước 1 ngày). */
  appointmentAt?: string;
  now: number;
  canEdit: boolean;
};

/** Cột Nhắc hẹn (Booking management): bấm ô → popover tại chỗ — form nhanh + danh sách lịch nhắc của khách. */
export function CustomerRemindersPopover({ children, ...props }: Props & { children: React.ReactNode }) {
  const t = useTranslations("reminders");
  return (
    <Popover
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      destroyOnHidden
      title={`${t("title")} · ${props.customer.full_name}`}
      content={<RemindersPanel {...props} />}
    >
      {children}
    </Popover>
  );
}

function RemindersPanel({ customer, reminders, staff, appointmentAt, now, canEdit }: Props) {
  const t = useTranslations("reminders");
  const tc = useTranslations("common");
  const [form] = Form.useForm<ReminderInput>();
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [pending, start] = useTransition();
  const telesales = customerTelesales(staff, customer.staff_id);
  const blank = (): ReminderInput => ({ remind_at: suggestRemindAt(appointmentAt, now), note: "" });

  // Cùng 1 form cho thêm và sửa: bấm sửa ở 1 lịch → nạp lịch đó lên form.
  const edit = (r: Reminder | null) => {
    setEditing(r);
    form.setFieldsValue(r ? { remind_at: r.remind_at, note: r.note } : blank());
  };

  const submit = (values: ReminderInput) =>
    start(async () => {
      const res = editing ? await updateReminder(editing.id, values) : await createReminder(customer.id, values);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("saved"));
      edit(null);
    });

  // Chưa xong lên trước (sớm nhất trước), đã xong xuống cuối (mới nhất trước).
  const list = [...reminders].sort((a, b) =>
    !!a.done_at !== !!b.done_at
      ? a.done_at ? 1 : -1
      : a.done_at ? Date.parse(b.remind_at) - Date.parse(a.remind_at) : Date.parse(a.remind_at) - Date.parse(b.remind_at),
  );

  return (
    <div className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3">
      {canEdit && (
        <Form form={form} initialValues={blank()} onFinish={submit} className="flex flex-col gap-2">
          <Form.Item name="remind_at" trigger="onSave" rules={[{ required: true, message: t("chooseDate") }]} className="mb-0">
            <AppointmentDate className="w-full" onSave={() => {}} />
          </Form.Item>
          <Form.Item name="note" className="mb-0">
            <Input allowClear maxLength={5000} placeholder={t("notePlaceholder")} />
          </Form.Item>
          <div className="flex items-center justify-end gap-2">
            {editing && <Button onClick={() => edit(null)}>{tc("cancel")}</Button>}
            <Button type="primary" htmlType="submit" loading={pending}>
              {editing ? tc("save") : t("add")}
            </Button>
          </div>
        </Form>
      )}
      {/* Người nhận thông báo = Telesales phụ trách khách (không chọn tay). */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <BellRing className="size-3.5 shrink-0" />
        {telesales ? (
          <span className="flex items-center gap-1">
            {t("notifyTo")} {staffLabel(telesales)}
          </span>
        ) : (
          <span className="text-warning">{t("noTelesales")}</span>
        )}
      </div>
      <div className="-me-1 flex max-h-72 flex-col gap-2 overflow-y-auto pe-1">
        {list.length ? (
          list.map((r) => (
            <ReminderItem
              key={r.id}
              reminder={r}
              customer={customer}
              showCustomer={false}
              showAssignee={false}
              staff={staff}
              now={now}
              timeFormat="DD-MM-YYYY HH:mm"
              canEdit={canEdit}
              onEdit={() => edit(r)}
            />
          ))
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("empty")} className="my-2" />
        )}
      </div>
    </div>
  );
}
