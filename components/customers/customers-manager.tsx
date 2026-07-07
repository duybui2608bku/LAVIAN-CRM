"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, RefreshCw, Search, Trash2, UserPlus } from "lucide-react";

import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
} from "@/app/(app)/customers/actions";
import { matchesCustomerFilters, optionLabel } from "@/lib/customers";
import { cn } from "@/lib/utils";
import { ClearableSelect } from "@/components/common/clearable-select";
import { DatePicker, DateRangePicker } from "@/components/common/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  Customer,
  CustomerInput,
  EnumKind,
  EnumOption,
} from "@/types/customer";

type Staff = { id: string; user_name: string };

// Class cho <textarea> ghi chú — khớp trông với <Input>.
const fieldCls =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function CustomersManager({
  customers,
  staff,
  options,
}: {
  customers: Customer[];
  staff: Staff[];
  options: EnumOption[];
}) {
  const t = useTranslations("customers");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [staffId, setStaffId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [target, setTarget] = useState<Customer | "new" | null>(null);

  const activeByKind = (kind: EnumKind) =>
    options.filter((o) => o.kind === kind && o.is_active);

  // Nhãn (theo locale) cho một value bất kỳ — dùng cả option inactive để hiện dữ liệu cũ.
  const labelFor = (kind: EnumKind, value: string | null) => {
    if (!value) return "—";
    const opt = options.find((o) => o.kind === kind && o.value === value);
    return opt ? optionLabel(opt, locale) : value;
  };
  const staffName = (id: string | null) =>
    (id && staff.find((s) => s.id === id)?.user_name) || "—";

  const filtered = useMemo(
    () =>
      customers.filter((c) =>
        matchesCustomerFilters(c, { search, stage, source, staffId, from, to }),
      ),
    [customers, search, stage, source, staffId, from, to],
  );

  const onDelete = (c: Customer) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    start(async () => {
      const res = await deleteCustomer(c.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("deleteOk"));
      router.refresh();
    });
  };

  const editing = target && target !== "new" ? target : null;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => start(() => router.refresh())}
            disabled={pending}
          >
            <RefreshCw className={cn("size-4", pending && "animate-spin")} />
            {t("reload")}
          </Button>
          <Button onClick={() => setTarget("new")}>
            <UserPlus className="size-4" />
            {t("create")}
          </Button>
        </div>
      </div>

      {/* Thanh lọc */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative w-full sm:max-w-[220px]">
          <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="h-8 pl-8"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ClearableSelect
          value={stage}
          onValueChange={setStage}
          options={activeByKind("stage").map((o) => ({
            value: o.value,
            label: optionLabel(o, locale),
          }))}
          placeholder={t("allStage")}
          clearLabel={t("clear")}
          ariaLabel={t("colStage")}
        />
        <ClearableSelect
          value={source}
          onValueChange={setSource}
          options={activeByKind("source").map((o) => ({
            value: o.value,
            label: optionLabel(o, locale),
          }))}
          placeholder={t("allSource")}
          clearLabel={t("clear")}
          ariaLabel={t("colSource")}
        />
        <ClearableSelect
          value={staffId}
          onValueChange={setStaffId}
          options={staff.map((s) => ({
            value: s.id,
            label: s.user_name || "—",
          }))}
          placeholder={t("allStaff")}
          clearLabel={t("clear")}
          ariaLabel={t("colStaff")}
        />
        <DateRangePicker
          from={from}
          to={to}
          onChange={(r) => {
            setFrom(r.from);
            setTo(r.to);
          }}
          placeholder={t("dateRange")}
          clearLabel={t("clearDate")}
          className="w-[240px]"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colPhone")}</TableHead>
              <TableHead>{t("colStage")}</TableHead>
              <TableHead>{t("colSource")}</TableHead>
              <TableHead>{t("colStaff")}</TableHead>
              <TableHead>{t("colFirstContact")}</TableHead>
              <TableHead>{t("colCreated")}</TableHead>
              <TableHead className="text-right">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>
                    <Badge variant={c.stage === "lost" ? "destructive" : "secondary"}>
                      {labelFor("stage", c.stage)}
                    </Badge>
                  </TableCell>
                  <TableCell>{labelFor("source", c.source)}</TableCell>
                  <TableCell>{staffName(c.staff_id)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.first_contact
                      ? new Date(c.first_contact).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      title={t("edit")}
                      aria-label={t("edit")}
                      disabled={pending}
                      onClick={() => setTarget(c)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title={t("delete")}
                      aria-label={t("delete")}
                      disabled={pending}
                      onClick={() => onDelete(c)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CustomerDialog
        open={target !== null}
        editing={editing}
        staff={staff}
        options={options}
        onClose={() => setTarget(null)}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

const schema = z.object({
  full_name: z.string().min(1),
  phone: z.string().min(1),
  social_link: z.string().url().optional().or(z.literal("")),
  stage: z.string().min(1),
  source: z.string().optional(),
  staff_id: z.string().optional(),
  lost_reason: z.string().optional(),
  first_contact: z.string().optional(),
  note: z.string().optional(),
});
type Values = z.infer<typeof schema>;

function CustomerDialog({
  open,
  editing,
  staff,
  options,
  onClose,
  onDone,
}: {
  open: boolean;
  editing: Customer | null;
  staff: Staff[];
  options: EnumOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("customers");
  const locale = useLocale();
  const [pending, start] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    // values (deep-compare) tự nạp lại khi mở khách khác; typing không bị reset.
    values: {
      full_name: editing?.full_name ?? "",
      phone: editing?.phone ?? "",
      social_link: editing?.social_link ?? "",
      stage: editing?.stage ?? "new_lead",
      source: editing?.source ?? "",
      staff_id: editing?.staff_id ?? "",
      lost_reason: editing?.lost_reason ?? "",
      first_contact: editing?.first_contact
        ? editing.first_contact.slice(0, 10)
        : "",
      note: "",
    },
  });

  const stage = watch("stage");

  // Option cho Select trong form: active + giá trị hiện tại (kể cả inactive).
  const selectOptions = (kind: EnumKind, current?: string | null) =>
    options
      .filter(
        (o) => o.kind === kind && (o.is_active || o.value === current),
      )
      .sort((a, b) => a.sort_order - b.sort_order);

  const onSubmit = (v: Values) =>
    start(async () => {
      const notes = [...(editing?.notes ?? [])];
      const noteText = v.note?.trim();
      if (noteText) notes.push({ text: noteText, at: new Date().toISOString() });

      const input: CustomerInput = {
        full_name: v.full_name,
        phone: v.phone,
        social_link: v.social_link || null,
        source: v.source || null,
        stage: v.stage,
        lost_reason: v.lost_reason || null,
        staff_id: v.staff_id || null,
        first_contact: v.first_contact || null,
        notes,
      };
      const res = editing
        ? await updateCustomer(editing.id, input)
        : await createCustomer(input);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? t("updateOk") : t("createOk"));
      reset();
      onClose();
      onDone();
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("createTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("colName")} error={errors.full_name && t("required")}>
              <Input {...register("full_name")} />
            </Field>
            <Field label={t("colPhone")} error={errors.phone && t("required")}>
              <Input {...register("phone")} />
            </Field>
          </div>

          <Field
            label={t("socialLink")}
            error={errors.social_link && t("urlInvalid")}
          >
            <Input placeholder="https://…" {...register("social_link")} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("colStage")}>
              <Controller
                control={control}
                name="stage"
                render={({ field }) => (
                  <ClearableSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    clearable={false}
                    options={selectOptions("stage", editing?.stage).map((o) => ({
                      value: o.value,
                      label: optionLabel(o, locale),
                    }))}
                    ariaLabel={t("colStage")}
                  />
                )}
              />
            </Field>
            <Field label={t("colSource")}>
              <Controller
                control={control}
                name="source"
                render={({ field }) => (
                  <ClearableSelect
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    options={selectOptions("source", editing?.source).map((o) => ({
                      value: o.value,
                      label: optionLabel(o, locale),
                    }))}
                    placeholder={t("noneOption")}
                    clearLabel={t("clear")}
                    ariaLabel={t("colSource")}
                  />
                )}
              />
            </Field>
          </div>

          {stage === "lost" && (
            <Field label={t("colLostReason")}>
              <Controller
                control={control}
                name="lost_reason"
                render={({ field }) => (
                  <ClearableSelect
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    options={selectOptions("lost_reason", editing?.lost_reason).map(
                      (o) => ({ value: o.value, label: optionLabel(o, locale) }),
                    )}
                    placeholder={t("noneOption")}
                    clearLabel={t("clear")}
                    ariaLabel={t("colLostReason")}
                  />
                )}
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("colStaff")}>
              <Controller
                control={control}
                name="staff_id"
                render={({ field }) => (
                  <ClearableSelect
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    options={staff.map((s) => ({
                      value: s.id,
                      label: s.user_name || "—",
                    }))}
                    placeholder={t("noneOption")}
                    clearLabel={t("clear")}
                    ariaLabel={t("colStaff")}
                  />
                )}
              />
            </Field>
            <Field label={t("colFirstContact")}>
              <Controller
                control={control}
                name="first_contact"
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t("pickDate")}
                  />
                )}
              />
            </Field>
          </div>

          {/* Ghi chú: lịch sử note cũ + ô thêm note mới */}
          {editing?.notes?.length ? (
            <div className="space-y-1.5">
              <Label>{t("noteHistory")}</Label>
              <ul className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
                {editing.notes.map((n, i) => (
                  <li key={i} className="flex flex-col">
                    <span>{n.text}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(n.at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Field label={t("addNote")}>
            <textarea
              className={fieldCls + " h-auto min-h-16 resize-y py-1.5"}
              rows={2}
              placeholder={t("addNotePlaceholder")}
              {...register("note")}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : editing ? t("save") : t("createSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | false;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
