"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bug, CircleCheck, RefreshCw } from "lucide-react";

import { submitLead, type LeadInput } from "@/app/lead-form/actions";
import { Button } from "@/components/ui/button";
import { ClearableSelect } from "@/components/common/clearable-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { optionLabel } from "@/lib/customers";
import type { EnumOption } from "@/types/customer";

// Khớp trông với <Input> (pattern customers-manager).
const fieldCls =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

// Xin dữ liệu khách đang mở ở SMAX (parent trả về event __SM_FORM_CUSTOMER).
const requestCustomer = (integrationId: string) =>
  window.parent.postMessage(
    { name: "__SM_FORM_CUSTOMER", data: { integration_id: integrationId } },
    "*",
  );

// Metadata SMAX gửi kèm submit — server validate/strip lại.
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

const schema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().regex(/^[0-9+ ().-]{8,15}$/),
  staff_id: z.string(), // "" = không chọn
  stage: z.string(),
  note: z.string().trim().max(1000),
  website: z.string(), // honeypot ẩn
});
type Values = z.infer<typeof schema>;

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
  // Log debug: event postMessage gần nhất từ SMAX (kiểm tra payload thật khi nhúng).
  // Ẩn sau icon bug cạnh nút Gửi — bấm mới mở.
  const [eventLog, setEventLog] = useState("");
  const [showLog, setShowLog] = useState(false);
  // Nhúng iframe hay mở trực tiếp — cố định suốt vòng đời trang (SSR luôn false,
  // chỉ ảnh hưởng màn hình cảm ơn nên không lệch hydration).
  const [embedded] = useState(
    () => typeof window !== "undefined" && window.parent !== window,
  );

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      phone: "",
      staff_id: "",
      stage: "new_lead",
      note: "",
      website: "",
    },
  });

  // Tích hợp SMAX "Nhúng form" (tailieu.smax.ai) — chỉ chạy khi nằm trong iframe.
  // SMAX không tự bắn event khi đổi khách trong inbox nên poll xin lại
  // __SM_FORM_CUSTOMER; id khách đổi (A→B) mới nạp lại tên/SĐT, id giữ
  // nguyên thì không đụng form (không phá thứ nhân viên đang gõ).
  // ponytail: poll 3s — SMAX không có event chủ động; nếu có thì bỏ poll.
  const smaxIdRef = useRef<string | null>(null); // null = chưa nhận event nào
  // Metadata SMAX của khách đang mở (event gần nhất) — state chứ không ref vì
  // onSubmit đọc trong closure render (React Compiler cấm đọc ref khi render);
  // set có bail-out so JSON để poll 3s không re-render thừa.
  const [smaxMeta, setSmaxMeta] = useState<SmaxMeta>(EMPTY_META);
  useEffect(() => {
    if (!embedded) return;
    const onMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (typeof msg !== "object" || !msg?.name) return;
      // ponytail: chỉ giữ event cuối — cần lịch sử thì chuyển sang mảng.
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
      // Payload thật dùng mảng `phones`, field `phone` đơn chỉ là dự phòng.
      const phone = c.phone ?? (Array.isArray(c.phones) ? c.phones[0] : "");
      const prev = smaxIdRef.current;
      smaxIdRef.current = id;
      if (prev === null) {
        // Event đầu tiên: chỉ điền ô còn TRỐNG (không đè thứ khách gõ dở).
        if (c.name && !getValues("full_name"))
          setValue("full_name", String(c.name));
        if (phone && !getValues("phone")) setValue("phone", String(phone));
      } else if (id !== prev) {
        setValue("full_name", c.name ? String(c.name) : "");
        setValue("phone", phone ? String(phone) : "");
      }
    };
    window.addEventListener("message", onMessage);
    requestCustomer(integrationId);
    const timer = setInterval(() => requestCustomer(integrationId), 3000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [embedded, getValues, setValue, integrationId]);

  const closePopup = () =>
    window.parent.postMessage(
      {
        name: "__SM_FORM_POPUP",
        action: "HIDE",
        data: { integration_id: integrationId },
      },
      "*",
    );

  const onSubmit = (values: Values) =>
    start(async () => {
      const res = await submitLead({ ...values, source, ...smaxMeta });
      if (res?.error) toast.error(res.error);
      else setDone(true);
    });

  if (done)
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CircleCheck className="size-10 text-primary" />
        <p className="font-medium">{t("successTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("successBody")}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              setDone(false);
              // Prefill lại theo khách SMAX đang mở (event kế tiếp coi như đầu tiên).
              smaxIdRef.current = null;
              if (embedded) requestCustomer(integrationId);
            }}
          >
            {t("again")}
          </Button>
          {embedded && <Button onClick={closePopup}>{t("close")}</Button>}
        </div>
      </div>
    );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="full_name">{t("name")}</Label>
        <Input id="full_name" autoFocus {...register("full_name")} />
        {errors.full_name && (
          <p className="text-xs text-destructive">{t("nameRequired")}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">{t("phone")}</Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          {...register("phone")}
        />
        {errors.phone && (
          <p className="text-xs text-destructive">{t("phoneInvalid")}</p>
        )}
      </div>

      {staff.length > 0 && (
        <div className="space-y-1.5">
          <Label>{t("staff")}</Label>
          <Controller
            control={control}
            name="staff_id"
            render={({ field }) => (
              <ClearableSelect
                value={field.value}
                onValueChange={field.onChange}
                options={staff.map((s) => ({ value: s.id, label: s.user_name }))}
                placeholder={t("noteOptional")}
                ariaLabel={t("staff")}
              />
            )}
          />
        </div>
      )}

      {stages.length > 0 && (
        <div className="space-y-1.5">
          <Label>{t("stage")}</Label>
          <Controller
            control={control}
            name="stage"
            render={({ field }) => (
              <ClearableSelect
                value={field.value}
                onValueChange={field.onChange}
                clearable={false}
                options={stages.map((o) => ({
                  value: o.value,
                  label: optionLabel(o, locale),
                }))}
                ariaLabel={t("stage")}
              />
            )}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="note">{t("note")}</Label>
        <textarea
          id="note"
          rows={3}
          placeholder={t("noteOptional")}
          className={fieldCls}
          {...register("note")}
        />
        {errors.note && (
          <p className="text-xs text-destructive">{t("noteTooLong")}</p>
        )}
      </div>

      {embedded && showLog && (
        <div className="space-y-1.5">
          <Label htmlFor="event_log">{t("log")}</Label>
          <textarea
            id="event_log"
            rows={4}
            readOnly
            value={eventLog}
            className={fieldCls}
          />
        </div>
      )}

      {/* honeypot — người thật không thấy, bot điền là server bỏ qua */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        {...register("website")}
      />

      <div className="flex gap-2">
        {embedded && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("log")}
            onClick={() => setShowLog((v) => !v)}
          >
            <Bug />
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending && <RefreshCw className="animate-spin" />}
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
