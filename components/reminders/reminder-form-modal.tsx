"use client";

import { useTransition } from "react";
import { Form, Input, Modal, Select } from "antd";
import { useTranslations } from "next-intl";

import { createReminder, updateReminder } from "@/app/(app)/customers/reminders/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { toast } from "@/lib/toast";
import type { Reminder, ReminderInput } from "@/types/reminder";
import { TELESALES_DEPARTMENTS } from "@/types/user";

/** Người phụ trách: Telesales đang hoạt động + người đang gán (đổi bộ phận vẫn hiện). */
export const assigneeOptions = (staff: StaffRef[], current?: string | null) =>
  staff
    .filter(
      (s) =>
        (s.status !== "banned" && TELESALES_DEPARTMENTS.includes(s.department ?? "")) || s.id === current,
    )
    .map((s) => ({ value: s.id, label: staffLabel(s), search: s.user_name }));

/**
 * Modal thêm/sửa lịch nhắc. `editing` = sửa; không thì tạo mới cho `customerId` với `defaults`.
 * Đóng sau khi lưu xong (server action đã revalidate trang).
 */
export function ReminderFormModal({
  open,
  customerId,
  customerName,
  editing,
  defaults,
  staff,
  onClose,
}: {
  open: boolean;
  customerId: string;
  customerName: string;
  editing?: Reminder | null;
  defaults: ReminderInput;
  staff: StaffRef[];
  onClose: () => void;
}) {
  const t = useTranslations("reminders");
  const tc = useTranslations("common");
  const [form] = Form.useForm<ReminderInput>();
  const [pending, start] = useTransition();
  const initial: ReminderInput = editing
    ? { remind_at: editing.remind_at, assignee_id: editing.assignee_id, note: editing.note }
    : defaults;

  const submit = (values: ReminderInput) =>
    start(async () => {
      const res = editing ? await updateReminder(editing.id, values) : await createReminder(customerId, values);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("saved"));
      onClose();
    });

  return (
    <Modal
      open={open}
      title={`${editing ? t("editTitle") : t("add")} · ${customerName}`}
      okText={tc("save")}
      cancelText={tc("cancel")}
      confirmLoading={pending}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
      centered
    >
      <Form form={form} layout="vertical" initialValues={initial} onFinish={submit} className="pt-2">
        <div className="grid grid-cols-2 gap-x-4 max-sm:grid-cols-1">
          <Form.Item
            name="remind_at"
            label={t("remindAt")}
            trigger="onSave"
            rules={[{ required: true, message: t("chooseDate") }]}
          >
            <AppointmentDate className="w-full" onSave={() => {}} />
          </Form.Item>
          <Form.Item name="assignee_id" label={t("assignee")}>
            <Select
              allowClear
              showSearch={{ optionFilterProp: "search" }}
              placeholder={t("unassigned")}
              options={assigneeOptions(staff, editing?.assignee_id ?? defaults.assignee_id)}
            />
          </Form.Item>
        </div>
        <Form.Item name="note" label={t("note")} extra={t("noteHint")} className="mb-0">
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={5000} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
