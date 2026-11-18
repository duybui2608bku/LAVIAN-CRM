"use client";

import { useTransition } from "react";
import { Alert, Form, Input, Modal } from "antd";
import { useTranslations } from "next-intl";

import { createReminder, updateReminder } from "@/app/(app)/customers/reminders/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { toast } from "@/lib/toast";
import type { Reminder, ReminderInput } from "@/types/reminder";
import { TELESALES_DEPARTMENTS } from "@/types/user";

/** Telesales đang hoạt động — option lọc nhân viên ở trang calendar. */
export const telesalesOptions = (staff: StaffRef[]) =>
  staff
    .filter((s) => s.status !== "banned" && TELESALES_DEPARTMENTS.includes(s.department ?? ""))
    .map((s) => ({ value: s.id, label: staffLabel(s) }));

/** Telesales phụ trách khách — người duy nhất nhận thông báo (khớp điều kiện trong DB). */
export const customerTelesales = (staff: StaffRef[], staffId: string | null | undefined) => {
  const s = staffId ? staff.find((x) => x.id === staffId) : undefined;
  return s && s.status !== "banned" && TELESALES_DEPARTMENTS.includes(s.department ?? "") ? s : undefined;
};

/**
 * Modal thêm/sửa lịch nhắc. `editing` = sửa; không thì tạo mới cho `customerId` với `defaults`.
 * Đóng sau khi lưu xong (server action đã revalidate trang).
 */
export function ReminderFormModal({
  open,
  customerId,
  customerName,
  customerStaffId,
  editing,
  defaults,
  staff,
  onClose,
}: {
  open: boolean;
  customerId: string;
  customerName: string;
  /** Telesales phụ trách khách (customers.staff_id) — hiện để biết ai nhận thông báo. */
  customerStaffId: string | null;
  editing?: Reminder | null;
  defaults: ReminderInput;
  staff: StaffRef[];
  onClose: () => void;
}) {
  const t = useTranslations("reminders");
  const tc = useTranslations("common");
  const [form] = Form.useForm<ReminderInput>();
  const [pending, start] = useTransition();
  const telesales = customerTelesales(staff, customerStaffId);
  const initial: ReminderInput = editing
    ? { remind_at: editing.remind_at, note: editing.note }
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
          {/* Không chọn tay: thông báo chỉ gửi Telesales phụ trách khách (đổi ở cột Nhân viên). */}
          <Form.Item label={t("assignee")} tooltip={t("assigneeHint")}>
            <div className="flex h-8 items-center">{telesales ? staffLabel(telesales) : "—"}</div>
          </Form.Item>
        </div>
        {!telesales && <Alert type="warning" showIcon className="mb-4" message={t("noTelesales")} />}
        <Form.Item name="note" label={t("note")} className="mb-0">
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={5000} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
