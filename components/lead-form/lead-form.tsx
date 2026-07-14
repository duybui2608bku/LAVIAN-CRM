"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CircleCheck } from "lucide-react";

import { submitLead } from "@/app/lead-form/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Khớp trông với <Input> (pattern customers-manager).
const fieldCls =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const schema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().regex(/^[0-9+ ().-]{8,15}$/),
  note: z.string().trim().max(1000),
  website: z.string(), // honeypot ẩn
});
type Values = z.infer<typeof schema>;

export function LeadForm() {
  const t = useTranslations("leadForm");
  const params = useSearchParams();
  const integrationId = params.get("integration_id") ?? "";
  const source = params.get("source") ?? "";
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  // Nhúng iframe hay mở trực tiếp — cố định suốt vòng đời trang (SSR luôn false,
  // chỉ ảnh hưởng màn hình cảm ơn nên không lệch hydration).
  const [embedded] = useState(
    () => typeof window !== "undefined" && window.parent !== window,
  );
  const [smax, setSmax] = useState<{ id: string; name: string } | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", phone: "", note: "", website: "" },
  });

  // Tích hợp SMAX "Nhúng form" (tailieu.smax.ai) — chỉ chạy khi nằm trong iframe:
  // xin dữ liệu khách qua __SM_FORM_CUSTOMER rồi prefill các ô còn TRỐNG.
  useEffect(() => {
    if (!embedded) return;
    const onMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (typeof msg !== "object" || msg?.name !== "__SM_FORM_CUSTOMER") return;
      const c = msg.data?.customer ?? {};
      setSmax({ id: String(c.id ?? ""), name: String(c.name ?? "") });
      if (c.name && !getValues("full_name"))
        setValue("full_name", String(c.name));
      if (c.phone && !getValues("phone")) setValue("phone", String(c.phone));
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage(
      { name: "__SM_FORM_CUSTOMER", data: { integration_id: integrationId } },
      "*",
    );
    return () => window.removeEventListener("message", onMessage);
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
      const res = await submitLead({ ...values, source, smax });
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
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
