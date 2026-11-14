"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { Button, Divider, Empty, Form, Input, Select, Spin, Tag } from "antd";
import { CalendarPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dayjs from "dayjs";

import {
  createLeadAppointment,
  listLeadAppointments,
  type LeadAppointment,
  type LeadAppointmentInput,
} from "@/app/lead-form/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { ClearableSelect } from "@/components/common/clearable-select";
import { staffLabel } from "@/components/common/user-avatar";
import { serviceName } from "@/lib/customers";
import { toast } from "@/lib/toast";
import type { Service } from "@/types/service";

export type LeadService = Pick<Service, "id" | "name_vi" | "name_en" | "name_id" | "is_active">;

// Tab "Appointment" của Form SMAX: khách đã xác định theo smax_customer_id nên không có ô chọn khách;
// không hiện Clinic confirmation — server luôn lưu "chưa đến". Bên dưới là lịch sử lịch hẹn của khách.
export function LeadAppointmentForm({ smaxCustomerId, defaultStaffId, staffOptions, services }: {
  smaxCustomerId: string;
  defaultStaffId: string;
  staffOptions: { value: string; label: ReactNode }[];
  services: LeadService[];
}) {
  const t = useTranslations("appointments");
  const tl = useTranslations("leadForm");
  const locale = useLocale();
  const [form] = Form.useForm<LeadAppointmentInput>();
  const [pending, start] = useTransition();
  const [history, setHistory] = useState<LeadAppointment[] | null>(null);

  const loadHistory = useCallback(
    () => listLeadAppointments(smaxCustomerId).then(setHistory, () => setHistory([])),
    [smaxCustomerId],
  );
  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const onFinish = (values: LeadAppointmentInput) => start(async () => {
    try {
      const res = await createLeadAppointment(smaxCustomerId, values);
      if (res.error) toast.error(res.error);
      else {
        toast.success(t("saved"));
        form.resetFields();
        await loadHistory();
      }
    } catch {
      toast.error(t("saveError"));
    }
  });

  const serviceMap = new Map(services.map((s) => [s.id, serviceName(s, locale)]));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Form form={form} layout="vertical" requiredMark={false} disabled={pending}
        initialValues={{ staff_id: defaultStaffId, service_ids: [], note: "" }} onFinish={onFinish}>
        <div className="grid grid-cols-2 gap-3">
          <Form.Item name="scheduled_at" label={t("date")} trigger="onSave"
            rules={[{ required: true, message: t("chooseDate") }]}>
            <AppointmentDate className="w-full" onSave={() => {}} />
          </Form.Item>
          <Form.Item name="staff_id" label={t("staff")}>
            <ClearableSelect className="w-full" options={staffOptions} placeholder={t("choose")} ariaLabel={t("staff")} />
          </Form.Item>
        </div>
        <Form.Item name="service_ids" label={t("services")}>
          <Select mode="multiple" allowClear placeholder={t("choose")} optionFilterProp="label"
            options={services.filter((s) => s.is_active).map((s) => ({ value: s.id, label: serviceName(s, locale) }))} />
        </Form.Item>
        <Form.Item name="note" label={t("note")}>
          <Input.TextArea rows={2} maxLength={10000} />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={pending}
          icon={<CalendarPlus className="size-4" />}>
          {t("create")}
        </Button>
      </Form>

      <Divider titlePlacement="start" className="my-3!">{tl("history")}</Divider>
      {/* Lịch sử dài cuộn trong khung này — trang không cuộn. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
      {history === null ? (
        <div className="flex justify-center py-4"><Spin /></div>
      ) : history.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tl("historyEmpty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {history.map((a) => (
            <li key={a.id} className="flex flex-col gap-1.5 rounded border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{dayjs(a.scheduled_at).format("DD/MM/YYYY HH:mm")}</span>
                <Tag color={a.checked_in ? "green" : "default"} className="me-0">
                  {a.checked_in ? t("arrived") : t("notArrived")}
                </Tag>
              </div>
              {a.service_ids.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {a.service_ids.map((id) => (
                    <Tag key={id} color="purple" className="me-0">{serviceMap.get(id) ?? "—"}</Tag>
                  ))}
                </div>
              )}
              {a.staff_name && (
                <div className="text-sm">
                  {staffLabel({ id: "", user_name: a.staff_name, avatar_url: a.staff_avatar })}
                </div>
              )}
              {a.note && <p className="m-0 text-sm whitespace-pre-line text-muted-foreground">{a.note}</p>}
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  );
}
