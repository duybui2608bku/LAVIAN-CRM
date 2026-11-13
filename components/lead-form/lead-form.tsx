"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, Button, ConfigProvider, Form, Input, InputNumber, Result, Segmented, type ThemeConfig } from "antd";
import { useLocale, useTranslations } from "next-intl";
import { Bug } from "lucide-react";

import {
  checkLeadCustomer,
  submitLead,
  type LeadCustomer,
  type LeadInput,
  type LeadMode,
} from "@/app/lead-form/actions";
import { EnumTag } from "@/components/common/enum-tag";
import { LeadAppointmentForm, type LeadService } from "@/components/lead-form/lead-appointment-form";
import { ClearableSelect } from "@/components/common/clearable-select";
import { ImageUpload } from "@/components/common/image-upload";
import { RegionSelect } from "@/components/common/region-select";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { IDR_CURRENCY, sanitizeCurrencyInput } from "@/lib/currency";
import { optionLabel } from "@/lib/customers";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import type { EnumOption } from "@/types/customer";

const requestCustomer = (integrationId: string) =>
  window.parent.postMessage(
    { name: "__SM_FORM_CUSTOMER", data: { integration_id: integrationId } },
    "*",
  );

type SmaxMeta = Pick<
  LeadInput,
  "social_name" | "picture" | "tags" | "thread" | "smax_data"
>;

const EMPTY_META: SmaxMeta = {
  social_name: "",
  picture: "",
  tags: [],
  thread: null,
  smax_data: null,
};

type Values = {
  full_name: string;
  phone: string;
  staff_id: string;
  stage: string;
  deposit_amount: number | null;
  payment_confirm_url: string | null;
  region_code: string;
  address_detail: string;
  note: string;
  website: string; // honeypot chống bot — người thật không thấy ô này
};

// Trường lấy theo khách đang có trong CRM — fill khi tìm thấy, reset khi đổi khách.
const CRM_FIELDS = ["stage", "staff_id", "deposit_amount", "payment_confirm_url", "region_code", "address_detail"] as const;

const DEFAULTS: Values = {
  full_name: "",
  phone: "",
  region_code: "",
  address_detail: "",
  staff_id: "",
  stage: "new_lead",
  deposit_amount: null,
  payment_confirm_url: null,
  note: "",
  website: "",
};

const formatIdr = (v: number | string | undefined) =>
  v === undefined || v === "" ? "" : Number(v).toLocaleString("id-ID");
const parseIdr = (v: string | undefined) =>
  sanitizeCurrencyInput(v ?? "") as unknown as number;


type Tab = "customer" | "appointment";

type LeadFormProps = {
  staff: StaffRef[];
  stages: EnumOption[];
  services: LeadService[];
};

// Form nhúng trong khung SMAX hẹp → control/nhãn/khoảng cách gọn hơn phần còn lại của app.
const COMPACT: ThemeConfig = {
  token: { controlHeight: 36 },
  components: {
    Form: { itemMarginBottom: 12, verticalLabelPadding: "0 0 4px", labelFontSize: 13 },
  },
};

export function LeadForm(props: LeadFormProps) {
  return (
    <ConfigProvider theme={COMPACT}>
      <LeadFormInner {...props} />
    </ConfigProvider>
  );
}

function LeadFormInner({ staff, stages, services }: LeadFormProps) {
  const t = useTranslations("leadForm");
  const locale = useLocale();
  const params = useSearchParams();
  const integrationId = params.get("integration_id") ?? "";
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [eventLog, setEventLog] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [customerId, setCustomerId] = useState("");
  // Khách đã có trong CRM (giai đoạn + CSKH hiện tại) hoặc null.
  const [existing, setExisting] = useState<LeadCustomer | null>(null);
  const [checkingCustomer, setCheckingCustomer] = useState(false);
  const [tab, setTab] = useState<Tab>("customer");
  const [embedded] = useState(
    () => typeof window !== "undefined" && window.parent !== window,
  );

  const [form] = Form.useForm<Values>();
  const isDeposited = Form.useWatch("stage", form) === "deposited";

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
        social_name: c.name_original ? String(c.name_original) : "",
        picture: c.picture ? String(c.picture) : "",
        tags: Array.isArray(c.tags) ? c.tags : [],
        thread: msg.data?.thread ?? null,
        smax_data: msg.data && typeof msg.data === "object" ? msg.data : null,
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
        setExisting(null);
      } else {
        setCheckingCustomer(true);
        void checkLeadCustomer(id)
          .then((found) => {
            if (smaxIdRef.current !== id) return;
            setExisting(found);
            // Fill giá trị hiện tại trong CRM — bỏ qua ô người dùng đã tự chọn.
            if (found) {
              for (const f of CRM_FIELDS) {
                if (!form.isFieldTouched(f)) form.setFieldValue(f, found[f]);
              }
            }
          })
          .catch(() => {
            if (smaxIdRef.current === id) setExisting(null);
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
          form.setFieldValue("phone", formatPhone(String(phone)));
        }
      } else if (id !== prev) {
        // Đổi sang khách khác: reset luôn giai đoạn/CSKH của khách trước.
        form.resetFields([...CRM_FIELDS]);
        form.setFieldsValue({
          full_name: c.name ? String(c.name) : "",
          phone: phone ? formatPhone(String(phone)) : "",
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
      const values = { ...raw, full_name: raw.full_name.trim(), phone: formatPhone(raw.phone) };
      const res = await submitLead(
        {
          ...values,
          customer_id: customerId,
          ...smaxMeta,
        },
        mode,
      );
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setDone(true);
    }), () => {}); // thiếu dữ liệu: antd đã hiện lỗi dưới từng ô

  // CSKH hiện tại có thể đã nghỉ/khác bộ phận → vẫn hiện tên thay vì uuid.
  const staffOptions = staff.map((s) => ({ value: s.id, label: staffLabel(s) }));
  if (existing?.staff_id && !staff.some((s) => s.id === existing.staff_id)) {
    staffOptions.push({
      value: existing.staff_id,
      label: staffLabel({
        id: existing.staff_id,
        user_name: existing.staff_name,
        avatar_url: existing.staff_avatar,
      }),
    });
  }

  // Tab Lịch hẹn chỉ mở khi khách đã có trong CRM; đổi sang khách chưa có → về tab Khách hàng.
  const appointmentEnabled = !!existing && !checkingCustomer;
  const activeTab: Tab = appointmentEnabled ? tab : "customer";

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
    <div className="flex flex-col gap-3">
      <Segmented<Tab>
        block
        value={activeTab}
        onChange={setTab}
        options={[
          { value: "customer", label: t("tabCustomer") },
          { value: "appointment", label: t("tabAppointment"), disabled: !appointmentEnabled },
        ]}
      />
      {/* 2 tab chỉ ẩn (không unmount) để giữ dữ liệu đang nhập khi chuyển tab. */}
      {existing && (
        <div className={activeTab === "appointment" ? undefined : "hidden"}>
          <LeadAppointmentForm
            key={customerId}
            smaxCustomerId={customerId}
            defaultStaffId={existing.staff_id}
            staffOptions={staffOptions}
            services={services}
          />
        </div>
      )}
      <Form form={form} layout="vertical" requiredMark={false} initialValues={DEFAULTS}
        className={activeTab === "customer" ? undefined : "hidden"}>
        {existing && (
          <Alert type="warning" showIcon className="mb-3" title={t("existingCustomer")} />
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
          <Input type="text" inputMode="tel" autoComplete="tel" />
        </Form.Item>
        {/* Tỉnh + Huyện/TP trên 1 hàng 2 cột. */}
        <Form.Item name="region_code" label={t("region")}>
          <RegionSelect provinceLabel={t("province")} cityLabel={t("city")} />
        </Form.Item>
        <Form.Item name="address_detail" label={t("addressDetail")} rules={[{ max: 500 }]}>
          <Input placeholder={t("noteOptional")} />
        </Form.Item>
        {staff.length > 0 && (
          <Form.Item name="staff_id" label={t("staff")}>
            <ClearableSelect
              options={staffOptions}
              placeholder={t("noteOptional")}
              ariaLabel={t("staff")}
            />
          </Form.Item>
        )}
        {stages.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <Form.Item name="stage" label={t("stage")}>
              <ClearableSelect
                className="w-full"
                clearable={false}
                options={stages.map((o) => ({ value: o.value, label: <EnumTag label={optionLabel(o, locale)} color={o.color} icon={o.icon} /> }))}
                ariaLabel={t("stage")}
              />
            </Form.Item>
            {/* Chỉ nhập được khi giai đoạn là "Deposited". */}
            <Form.Item name="deposit_amount" label={t("deposit")}>
              <InputNumber<number>
                className="w-full"
                min={0}
                precision={0}
                controls={false}
                inputMode="numeric"
                placeholder="0"
                suffix={IDR_CURRENCY}
                formatter={formatIdr}
                parser={parseIdr}
                disabled={!isDeposited}
              />
            </Form.Item>
          </div>
        )}
        <Form.Item name="payment_confirm_url" label={t("paymentConfirm")}>
          <ImageUpload paste label={t("uploadImage")} />
        </Form.Item>
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

        {/* Dính đáy màn hình: form dài vẫn thấy nút Submit/Update không cần cuộn. */}
        <div className="sticky bottom-0 z-10 -mx-3 flex gap-2 border-t border-border bg-background px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
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
            disabled={checkingCustomer || !!existing}
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
    </div>
  );
}
