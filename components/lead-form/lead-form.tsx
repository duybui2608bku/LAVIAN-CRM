"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bug, CircleCheck, RefreshCw } from "lucide-react";

import {
  checkLeadCustomer,
  submitLead,
  type LeadInput,
  type LeadMode,
} from "@/app/lead-form/actions";
import { Button } from "@/components/ui/button";
import { ClearableSelect } from "@/components/common/clearable-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { optionLabel } from "@/lib/customers";
import type { EnumOption } from "@/types/customer";

const fieldCls =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

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

const schema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().regex(/^[0-9+ ().-]{8,15}$/),
  staff_id: z.string(),
  stage: z.string(),
  note: z.string().trim().max(1000),
  website: z.string(),
  deposit_amount: z.string(),
  deposit_currency: z.string(),
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
  const [eventLog, setEventLog] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [existing, setExisting] = useState(false);
  const [checkingCustomer, setCheckingCustomer] = useState(false);
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
      deposit_amount: "",
      deposit_currency: "VND",
    },
  });

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
        if (c.name && !getValues("full_name")) {
          setValue("full_name", String(c.name));
        }
        if (phone && !getValues("phone")) {
          setValue("phone", String(phone));
        }
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

  const onSubmit = (mode: LeadMode) => (values: Values) =>
    start(async () => {
      const amount = values.deposit_amount === ""
        ? null
        : Number(values.deposit_amount);
      const res = await submitLead(
        {
          ...values,
          customer_id: customerId,
          deposit_amount: amount,
          deposit_currency: amount === null ? null : values.deposit_currency,
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
    });

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="rounded-full bg-emerald-500/12 p-4 text-emerald-600">
          <CircleCheck className="size-16" strokeWidth={1.75} />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold">{t("successTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("successBody")}</p>
        </div>
        <Button
          onClick={() => {
            reset();
            setDone(false);
            smaxIdRef.current = null;
            if (embedded) requestCustomer(integrationId);
          }}
        >
          {t("again")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="grid gap-3">
      {existing && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          {t("existingCustomer")}
        </p>
      )}
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
        <Label htmlFor="deposit_amount">{t("deposit")}</Label>
        <div className="flex gap-2">
          <Input
            id="deposit_amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className="flex-1"
            {...register("deposit_amount")}
          />
          <select
            aria-label={t("currency")}
            className={`${fieldCls} w-24`}
            {...register("deposit_currency")}
          >
            <option value="VND">VND</option>
            <option value="IDR">IDR</option>
            <option value="USD">USD</option>
          </select>
        </div>
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
        <Button
          type="button"
          className="flex-1"
          disabled={pending || checkingCustomer || existing}
          onClick={handleSubmit(onSubmit("create"))}
        >
          {pending && <RefreshCw className="animate-spin" />}
          {t("submit")}
        </Button>
        {existing && (
          <Button
            type="button"
            className="flex-1"
            disabled={pending || checkingCustomer}
            onClick={handleSubmit(onSubmit("update"))}
          >
            {pending && <RefreshCw className="animate-spin" />}
            {t("update")}
          </Button>
        )}
      </div>
    </form>
  );
}
