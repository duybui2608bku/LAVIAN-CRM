"use client";

import { useTransition, type ReactNode } from "react";
import { Button, Form, Input, Select } from "antd";
import { CalendarPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { createLeadAppointment, type LeadAppointmentInput } from "@/app/lead-form/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { ClearableSelect } from "@/components/common/clearable-select";
import { serviceName } from "@/lib/customers";
import { toast } from "@/lib/toast";
import type { Service } from "@/types/service";

export type LeadService = Pick<Service, "id" | "name_vi" | "name_en" | "name_id">;

// Tab "Appointment" của Form SMAX: khách đã xác định theo smax_customer_id nên không có ô chọn khách;
// không hiện Clinic confirmation — server luôn lưu "chưa đến".
export function LeadAppointmentForm({ smaxCustomerId, defaultStaffId, staffOptions, services }: {
  smaxCustomerId: string;
  defaultStaffId: string;
  staffOptions: { value: string; label: ReactNode }[];
  services: LeadService[];
}) {
  const t = useTranslations("appointments");
  const locale = useLocale();
  const [form] = Form.useForm<LeadAppointmentInput>();
  const [pending, start] = useTransition();

  const onFinish = (values: LeadAppointmentInput) => start(async () => {
    try {
      const res = await createLeadAppointment(smaxCustomerId, values);
      if (res.error) toast.error(res.error);
      else {
        toast.success(t("saved"));
        form.resetFields();
      }
    } catch {
      toast.error(t("saveError"));
    }
  });

  return (
    <Form form={form} layout="vertical" size="large" requiredMark={false} disabled={pending}
      initialValues={{ staff_id: defaultStaffId, service_ids: [], note: "" }} onFinish={onFinish}>
      <Form.Item name="scheduled_at" label={t("date")} trigger="onSave"
        rules={[{ required: true, message: t("chooseDate") }]}>
        <AppointmentDate onSave={() => {}} />
      </Form.Item>
      <Form.Item name="service_ids" label={t("services")}>
        <Select mode="multiple" allowClear placeholder={t("choose")} optionFilterProp="label"
          options={services.map((s) => ({ value: s.id, label: serviceName(s, locale) }))} />
      </Form.Item>
      {staffOptions.length > 0 && (
        <Form.Item name="staff_id" label={t("staff")}>
          <ClearableSelect options={staffOptions} placeholder={t("choose")} ariaLabel={t("staff")} />
        </Form.Item>
      )}
      <Form.Item name="note" label={t("note")}>
        <Input.TextArea rows={3} maxLength={10000} />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={pending}
        icon={<CalendarPlus className="size-4" />}>
        {t("create")}
      </Button>
    </Form>
  );
}
