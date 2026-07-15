"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CircleCheck, RefreshCw } from "lucide-react";

import { submitLead } from "@/app/lead-form/actions";
import { Button } from "@/components/ui/button";
import { ClearableSelect } from "@/components/common/clearable-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Khớp trông với <Input> (pattern customers-manager).
const fieldCls =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

// Xin dữ liệu khách đang mở ở SMAX (parent trả về event __SM_FORM_CUSTOMER).
const requestCustomer = (integrationId: string) =>
  window.parent.postMessage(
    { name: "__SM_FORM_CUSTOMER", data: { integration_id: integrationId } },
    "*",
  );

const schema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().regex(/^[0-9+ ().-]{8,15}$/),
  staff_id: z.string(), // "" = không chọn
  note: z.string().trim().max(1000),
  website: z.string(), // honeypot ẩn
});
type Values = z.infer<typeof schema>;

export function LeadForm({
  staff,
}: {
  staff: { id: string; user_name: string }[];
}) {
  const t = useTranslations("leadForm");
  const params = useSearchParams();
  const integrationId = params.get("integration_id") ?? "";
  const source = params.get("source") ?? "";
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  // Log debug: event postMessage gần nhất từ SMAX (kiểm tra payload thật khi nhúng).
  const [eventLog, setEventLog] = useState("");
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
  useEffect(() => {
    if (!embedded) return;
    const onMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (typeof msg !== "object" || !msg?.name) return;
      // ponytail: chỉ giữ event cuối — cần lịch sử thì chuyển sang mảng.
      setEventLog(JSON.stringify(msg, null, 2));
      if (msg.name !== "__SM_FORM_CUSTOMER") return;
      const c = msg.data?.customer ?? {};
      const id = c.id ? String(c.id) : "";
      const prev = smaxIdRef.current;
      smaxIdRef.current = id;
      if (prev === null) {
        // Event đầu tiên: chỉ điền ô còn TRỐNG (không đè thứ khách gõ dở).
        if (c.name && !getValues("full_name"))
          setValue("full_name", String(c.name));
        if (c.phone && !getValues("phone")) setValue("phone", String(c.phone));
      } else if (id !== prev) {
        setValue("full_name", c.name ? String(c.name) : "");
        setValue("phone", c.phone ? String(c.phone) : "");
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
      const res = await submitLead({ ...values, source });
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

      {embedded && (
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

      <Button type="submit" disabled={pending}>
        {pending && <RefreshCw className="animate-spin" />}
        {t("submit")}
      </Button>
    </form>
  );
}
