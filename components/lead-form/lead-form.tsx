"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, Button, Form, Input, Result } from "antd";
import { useLocale, useTranslations } from "next-intl";
import { Bug } from "lucide-react";

import {
  checkLeadCustomer,
  submitLead,
  type LeadInput,
  type LeadMode,
} from "@/app/lead-form/actions";
import { ClearableSelect } from "@/components/common/clearable-select";
import { optionLabel } from "@/lib/customers";
import { normalizePhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import type { EnumOption } from "@/types/customer";

const requestCustomer = (integrationId: string) =>
  window.parent.postMessage(
    { name: "__SM_FORM_CUSTOMER", data: { integration_id: integrationId } },
    "*",
  );

type SmaxMeta = Pick<
  LeadInput,
  "platform" | "social_name" | "picture" | "tags" | "thread"
>;

const EMPTY_META: SmaxMeta = {
  platform: "",
  social_name: "",
  picture: "",
  tags: [],
  thread: null,
};

type Values = {
  full_name: string;
  phone: string;
  staff_id: string;
  stage: string;
  note: string;
  website: string; // honeypot chống bot — người thật không thấy ô này
};

const DEFAULTS: Values = {
  full_name: "",
  phone: "",
  staff_id: "",
  stage: "new_lead",
  note: "",
  website: "",
};



export function LeadForm({
  staff,
  stages,
}: {
  staff: { id: string; user_name: string }[];
  stages: EnumOption[];
}) {
  const t = useTranslations("leadForm");
  const locale = useLocale();
  const params = useSearchParams();
  const integrationId = params.get("integration_id") ?? "";
  const source = params.get("source") ?? "";
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [eventLog, setEventLog] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [existing, setExisting] = useState(false);
  const [checkingCustomer, setCheckingCustomer] = useState(false);
  const [embedded] = useState(
    () => typeof window !== "undefined" && window.parent !== window,
  );

  const [form] = Form.useForm<Values>();

  const smaxIdRef = useRef<string | null>(null);
  const [smaxMeta, setSmaxMeta] = useState<SmaxMeta>(EMPTY_META);

  useEffect(() => {
    if (!embedded) return;

    const onMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (typeof msg !== "object" || !msg?.name) return;

      setEventLog(JSON.stringify(msg, null, 2));
      if (msg.name !== "__SM_FORM_CUSTOMER") return;

      const c = msg.data?.customer ?? {};
      const meta: SmaxMeta = {
        platform: c.platform ? String(c.platform) : "",
        social_name: c.name_original ? String(c.name_original) : "",
        picture: c.picture ? String(c.picture) : "",
        tags: Array.isArray(c.tags) ? c.tags : [],
        thread: msg.data?.thread ?? null,
      };

      setSmaxMeta((prev) =>
        JSON.stringify(prev) === JSON.stringify(meta) ? prev : meta,
      );

      const id = c.id ? String(c.id) : "";
      const phone = c.phone ?? (Array.isArray(c.phones) ? c.phones[0] : "");
      const prev = smaxIdRef.current;
      smaxIdRef.current = id;
      setCustomerId(id);

      if (id === prev) {
        // Poll cùng một khách: không query DB lại và không đụng dữ liệu đang nhập.
      } else if (!id) {
        setExisting(false);
      } else {
        setCheckingCustomer(true);
        void checkLeadCustomer(id)
          .then((found) => {
            if (smaxIdRef.current === id) setExisting(found);
          })
          .catch(() => {
            if (smaxIdRef.current === id) setExisting(false);
          })
          .finally(() => {
            if (smaxIdRef.current === id) setCheckingCustomer(false);
          });
      }

      if (prev === null) {
        if (c.name && !form.getFieldValue("full_name")) {
          form.setFieldValue("full_name", String(c.name));
        }
        if (phone && !form.getFieldValue("phone")) {
          form.setFieldValue("phone", normalizePhone(String(phone)));
        }
      } else if (id !== prev) {
        form.setFieldsValue({
          full_name: c.name ? String(c.name) : "",
          phone: phone ? normalizePhone(String(phone)) : "",
        });
      }
    };

    window.addEventListener("message", onMessage);
    requestCustomer(integrationId);
    const timer = setInterval(() => requestCustomer(integrationId), 3000);

    return () => {
      clearInterval(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [embedded, form, integrationId]);

  const onSubmit = (mode: LeadMode) => () =>
    void form.validateFields().then((raw) => start(async () => {
      const values = { ...raw, full_name: raw.full_name.trim(), phone: normalizePhone(raw.phone) };
      const res = await submitLead(
        {
          ...values,
          customer_id: customerId,
          source,
          ...smaxMeta,
        },
        mode,
      );
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setDone(true);
    }));

  if (done) {
    return (
      <Result
        status="success"
        title={t("successTitle")}
        subTitle={t("successBody")}
        extra={
          <Button
            type="primary"
            onClick={() => {
              form.resetFields();
              setDone(false);
              smaxIdRef.current = null;
              if (embedded) requestCustomer(integrationId);
            }}
          >
            {t("again")}
          </Button>
        }
      />
    );
  }

  return (
    <Form form={form} layout="vertical" requiredMark={false} initialValues={DEFAULTS}>
      {existing && (
        <Alert type="warning" showIcon className="mb-4" title={t("existingCustomer")} />
      )}
      <Form.Item
        name="full_name"
        label={t("name")}
        rules={[{ required: true, whitespace: true, max: 120, message: t("nameRequired") }]}
      >
        <Input autoFocus />
      </Form.Item>
      <Form.Item
        name="phone"
        label={t("phone")}
        rules={[{ required: true, message: t("phoneInvalid") }]}
        normalize={normalizePhone}
      >
        <Input type="text" autoComplete="tel" />
      </Form.Item>
      {staff.length > 0 && (
        <Form.Item name="staff_id" label={t("staff")}>
          <ClearableSelect
            options={staff.map((s) => ({ value: s.id, label: s.user_name }))}
            placeholder={t("noteOptional")}
            ariaLabel={t("staff")}
          />
        </Form.Item>
      )}
      {stages.length > 0 && (
        <Form.Item name="stage" label={t("stage")}>
          <ClearableSelect
            clearable={false}
            options={stages.map((o) => ({ value: o.value, label: optionLabel(o, locale) }))}
            ariaLabel={t("stage")}
          />
        </Form.Item>
      )}
      <Form.Item
        name="note"
        label={t("note")}
        rules={[{ max: 1000, message: t("noteTooLong") }]}
      >
        <Input.TextArea rows={3} placeholder={t("noteOptional")} />
      </Form.Item>
      {embedded && showLog && (
        <Form.Item label={t("log")}>
          <Input.TextArea rows={4} readOnly value={eventLog} />
        </Form.Item>
      )}
      <Form.Item name="website" hidden>
        <Input tabIndex={-1} autoComplete="off" aria-hidden="true" />
      </Form.Item>

      <div className="flex gap-2">
        {embedded && (
          <Button
            aria-label={t("log")}
            icon={<Bug className="size-4" />}
            onClick={() => setShowLog((v) => !v)}
          />
        )}
        <Button
          type="primary"
          className="flex-1"
          loading={pending}
          disabled={checkingCustomer || existing}
          onClick={onSubmit("create")}
        >
          {t("submit")}
        </Button>
        {existing && (
          <Button
            type="primary"
            className="flex-1"
            loading={pending}
            disabled={checkingCustomer}
            onClick={onSubmit("update")}
          >
            {t("update")}
          </Button>
        )}
      </div>
    </Form>
  );
}
