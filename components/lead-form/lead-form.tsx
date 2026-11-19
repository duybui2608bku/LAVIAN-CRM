"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Button, ConfigProvider, Form, Input, InputNumber, Result, Select, Tooltip, type FormInstance, type ThemeConfig } from "antd";
import { useLocale, useTranslations } from "next-intl";
import { Bug, CircleAlert } from "lucide-react";

import {
  checkLeadCustomer,
  submitLead,
  type LeadCustomer,
  type LeadInput,
  type LeadMode,
} from "@/app/lead-form/actions";
import { AppointmentDate } from "@/components/appointments/appointment-date";
import { ClearableSelect } from "@/components/common/clearable-select";
import { ImageUpload } from "@/components/common/image-upload";
import { RegionSelect } from "@/components/common/region-select";
import { staffLabel, type StaffRef } from "@/components/common/user-avatar";
import { IDR_CURRENCY, sanitizeCurrencyInput } from "@/lib/currency";
import { optionLabel } from "@/lib/customers";
import { isFollowUpStage, needsAppointment, SHOW_UP_STAGE } from "@/lib/customer-options";
import { formatPhone, isValidPhone, normalizePhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { EnumOption } from "@/types/customer";
import { SERVICE_CATEGORY_OPTIONS, type ServiceCategory } from "@/types/service";

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
  // Lịch nhắc follow-up — chỉ stage Tiềm năng / Cân nhắc (không phải lịch hẹn).
  follow_up_at: string | null;
  // Lịch hẹn tới chi nhánh kèm theo — các stage còn lại (bắt buộc khi vừa chọn Booking).
  scheduled_at: string;
  service_categories: ServiceCategory[];
  website: string; // honeypot chống bot — người thật không thấy ô này
};

// Trường lấy theo khách đang có trong CRM — fill khi tìm thấy, reset khi đổi khách.
const CRM_FIELDS = ["stage", "staff_id", "deposit_amount", "payment_confirm_url", "region_code", "address_detail", "follow_up_at"] as const;

const DEFAULTS: Values = {
  full_name: "",
  phone: "",
  region_code: "",
  address_detail: "",
  staff_id: "",
  stage: "", // bắt buộc chọn — không còn mặc định
  deposit_amount: null,
  payment_confirm_url: null,
  note: "",
  follow_up_at: null,
  scheduled_at: "",
  service_categories: [],
  website: "",
};

// Form không đăng nhập → nhớ Telesales đã chọn trên máy này (trong iframe Smax là kho riêng theo smax.ai).
// try/catch: trình duyệt chặn storage trong iframe sẽ throw — khi đó chỉ là không nhớ.
const STAFF_KEY = "lavian-lead-staff";
const readSavedStaff = () => {
  try {
    return localStorage.getItem(STAFF_KEY) ?? "";
  } catch {
    return "";
  }
};
const saveStaff = (id: string) => {
  try {
    if (id) localStorage.setItem(STAFF_KEY, id);
  } catch {}
};
/** Ô Telesales đang trống → điền người đã lưu (nếu còn trong danh sách Telesales). */
const fillSavedStaff = (form: FormInstance<Values>, staff: StaffRef[]) => {
  if (form.getFieldValue("staff_id")) return;
  const id = readSavedStaff();
  if (staff.some((s) => s.id === id)) form.setFieldValue("staff_id", id);
};

const formatIdr =(v: number | string | undefined) =>
  v === undefined || v === "" ? "" : Number(v).toLocaleString("id-ID");
const parseIdr = (v: string | undefined) =>
  sanitizeCurrencyInput(v ?? "") as unknown as number;


type LeadFormProps = {
  staff: StaffRef[];
  stages: EnumOption[];
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

function LeadFormInner({ staff, stages }: LeadFormProps) {
  const t = useTranslations("leadForm");
  const ta = useTranslations("appointments");
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
  const [embedded] = useState(
    () => typeof window !== "undefined" && window.parent !== window,
  );

  const [form] = Form.useForm<Values>();
  const stage = Form.useWatch("stage", form);
  const isDeposited = stage === "deposited";
  // Tiềm năng / Cân nhắc → ô Lịch nhắc (bắt buộc); stage khác → ô Lịch hẹn + dịch vụ (bắt buộc khi vừa chọn Booking).
  const followUp = isFollowUpStage(stage);
  const needAppointment = needsAppointment(stage, existing?.stage);

  const smaxIdRef = useRef<string | null>(null);
  const [smaxMeta, setSmaxMeta] = useState<SmaxMeta>(EMPTY_META);

  // localStorage chỉ có ở client → điền sau khi Form mount (lần đầu + sau "Gửi tiếp").
  useEffect(() => {
    if (!done) fillSavedStaff(form, staff);
  }, [done, form, staff]);

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
        // Kèm SĐT: khách đổi kênh (IG → WA) có SMAX id mới vẫn nhận ra khách cũ.
        void checkLeadCustomer(id, phone ? formatPhone(String(phone)) : "")
          .then((found) => {
            if (smaxIdRef.current !== id) return;
            setExisting(found);
            // Fill giá trị hiện tại trong CRM — bỏ qua ô người dùng đã tự chọn.
            if (found) {
              for (const f of CRM_FIELDS) {
                if (!form.isFieldTouched(f)) form.setFieldValue(f, found[f]);
              }
              fillSavedStaff(form, staff); // khách chưa có CSKH → dùng Telesales đã lưu
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
        // Đổi sang khách khác: reset luôn giai đoạn/CSKH/lịch hẹn đang nhập của khách trước.
        form.resetFields([...CRM_FIELDS, "scheduled_at", "service_categories"]);
        form.setFieldsValue({
          full_name: c.name ? String(c.name) : "",
          phone: phone ? formatPhone(String(phone)) : "",
        });
        fillSavedStaff(form, staff);
      }
    };

    window.addEventListener("message", onMessage);
    requestCustomer(integrationId);
    const timer = setInterval(() => requestCustomer(integrationId), 3000);

    return () => {
      clearInterval(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [embedded, form, integrationId, staff]);

  const onSubmit = (mode: LeadMode) => () =>
    void form.validateFields().then((raw) => start(async () => {
      const { scheduled_at, service_categories, follow_up_at, ...values } = { ...raw, full_name: raw.full_name.trim(), phone: formatPhone(raw.phone) };
      const followUpStage = isFollowUpStage(values.stage);
      const res = await submitLead(
        {
          ...values,
          // Tiềm năng / Cân nhắc → lịch nhắc; còn lại có chọn ngày giờ → server tạo lịch hẹn kèm.
          follow_up_at: followUpStage ? follow_up_at : null,
          appointment: !followUpStage && scheduled_at ? { scheduled_at, service_categories: service_categories ?? [] } : null,
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <FitToHeight>
      <Form
        form={form}
        layout="vertical"
        // Ô bắt buộc (theo rules.required, kể cả điều kiện như ngày hẹn) → dấu sao đỏ sau nhãn.
        requiredMark={(label, { required }) => (
          <>
            {label}
            {required && <span aria-hidden className="ms-1 text-destructive">*</span>}
          </>
        )}
        initialValues={DEFAULTS}
        // Chỉ chạy khi người dùng tự chọn (setFieldValue không kích hoạt) → không lưu nhầm CSKH của khách.
        onValuesChange={(changed: Partial<Values>) => {
          if (changed.staff_id) saveStaff(changed.staff_id);
        }}
      >
        <div className="grid grid-cols-2 gap-x-3">
          <Form.Item
            name="full_name"
            label={
              <span className="inline-flex items-center gap-1">
                {t("name")}
                {/* Khách đã có trong CRM: chỉ icon, hover/chạm mới hiện đủ câu. */}
                {existing && (
                  <Tooltip title={t("existingCustomer")} trigger={["hover", "click"]}>
                    <CircleAlert className="size-4 cursor-help text-warning" aria-label={t("existingCustomer")} />
                  </Tooltip>
                )}
              </span>
            }
            rules={[{ required: true, whitespace: true, max: 120, message: t("nameRequired") }]}
          >
            <Input autoFocus />
          </Form.Item>
          <Form.Item
            name="phone"
            label={t("phone")}
            rules={[
              { required: true, message: t("phoneInvalid") },
              { validator: (_, v?: string) => (!v || isValidPhone(v) ? Promise.resolve() : Promise.reject(new Error(t("phoneInvalid")))) },
            ]}
            normalize={normalizePhone}
          >
            <Input type="text" inputMode="tel" autoComplete="tel" />
          </Form.Item>
        </div>
        {/* Tạm ẩn "Địa chỉ chi tiết" (2026-11-16) — bỏ comment để hiện lại. Không gửi field → server giữ giá trị cũ.
        <Form.Item name="address_detail" label={t("addressDetail")} rules={[{ max: 500 }]}>
          <Input placeholder={t("noteOptional")} />
        </Form.Item>
        */}
        {/* Tỉnh | Huyện/TP: 2 ô nhãn riêng, cùng 1 giá trị region_code. */}
        <Form.Item name="region_code" noStyle>
          <RegionSelect
            provinceLabel={t("province")}
            cityLabel={t("city")}
            className="grid grid-cols-2 gap-x-3"
            field={(label, control) => <Form.Item label={label}>{control}</Form.Item>}
          />
        </Form.Item>
        {/* Thứ tự hàng: Telesales | Status → Ngày hẹn | Nhóm dịch vụ → Tiền cọc | Ảnh xác nhận thanh toán. */}
        <div className="grid grid-cols-2 gap-x-3">
          <Form.Item name="staff_id" label={t("staff")} rules={[{ required: true, message: t("staffRequired") }]}>
            <ClearableSelect
              className="w-full"
              clearable={false}
              options={staffOptions}
              placeholder={t("staffRequired")}
              ariaLabel={t("staff")}
            />
          </Form.Item>
          <Form.Item name="stage" label={t("stage")} rules={[{ required: true, message: t("stageRequired") }]}>
            <ClearableSelect
              className="w-full"
              clearable={false}
              placeholder={t("stageRequired")}
              // Show-up tự chuyển theo Clinic confirmation — chỉ hiện khi khách đang ở Show-up.
              // Chữ thường, không tag màu.
              options={stages
                .filter((o) => o.value !== SHOW_UP_STAGE || o.value === existing?.stage)
                .map((o) => ({ value: o.value, label: optionLabel(o, locale) }))}
              ariaLabel={t("stage")}
            />
          </Form.Item>
          {followUp ? (
            // Lịch nhắc follow-up (Telesales liên hệ lại) — không phải lịch hẹn tới chi nhánh.
            <Form.Item name="follow_up_at" label={t("followUpAt")} trigger="onSave" className="col-span-2"
              rules={[{ required: true, message: t("followUpRequired") }]}>
              <AppointmentDate className="w-full" onSave={() => {}} />
            </Form.Item>
          ) : (
            <>
              {/* dependencies: đổi stage → kiểm tra lại (bỏ lỗi "chọn ngày" khi stage không còn bắt buộc). */}
              <Form.Item name="scheduled_at" label={ta("date")} trigger="onSave" dependencies={["stage"]}
                rules={[{ required: needAppointment, message: ta("chooseDate") }]}>
                <AppointmentDate className="w-full" onSave={() => {}} />
              </Form.Item>
              <Form.Item name="service_categories" label={ta("serviceCategories")}>
                <Select mode="multiple" allowClear placeholder={ta("choose")} options={SERVICE_CATEGORY_OPTIONS} />
              </Form.Item>
            </>
          )}
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
          <Form.Item name="payment_confirm_url" label={t("paymentConfirm")}>
            <ImageUpload paste label={t("uploadImage")} className="aspect-auto h-20 w-full" />
          </Form.Item>
        </div>
        <Form.Item
          name="note"
          label={t("note")}
          rules={[{ max: 1000, message: t("noteTooLong") }]}
        >
          <Input.TextArea rows={2} placeholder={t("noteOptional")} />
        </Form.Item>
        {embedded && showLog && (
          <Form.Item label={t("log")}>
            <Input.TextArea rows={4} readOnly value={eventLog} />
          </Form.Item>
        )}
        <Form.Item name="website" hidden>
          <Input tabIndex={-1} autoComplete="off" aria-hidden="true" />
        </Form.Item>

        <div className="flex gap-2 pb-[env(safe-area-inset-bottom)]">
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
      </FitToHeight>
    </div>
  );
}

/**
 * Vừa chiều cao còn lại của màn hình, không cuộn dọc: nội dung cao hơn chỗ trống thì thu nhỏ
 * (scale, giữ nguyên bề ngang). Nhỏ hơn MIN_SCALE mới cho cuộn để chữ vẫn đọc được.
 */
const MIN_SCALE = 0.7;
function FitToHeight({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    // offsetHeight không tính transform → luôn là chiều cao thật của nội dung.
    const ro = new ResizeObserver(() => {
      const avail = o.clientHeight;
      const natural = i.offsetHeight;
      if (!avail || !natural) return; // chưa layout
      setScale(natural > avail ? Math.max(Math.floor((avail / natural) * 1000) / 1000, MIN_SCALE) : 1);
    });
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outer}
      className={cn("min-h-0 flex-1", scale > MIN_SCALE ? "overflow-hidden" : "overflow-y-auto")}
    >
      <div
        ref={inner}
        style={scale < 1 ? { transform: `scale(${scale})`, transformOrigin: "top left", width: `${100 / scale}%` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
