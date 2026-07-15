"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Pencil, Pipette, Plus, RefreshCw, Trash2, X } from "lucide-react";

import { createOption, deleteOption, updateOption } from "@/app/(app)/enums/actions";
import { cn } from "@/lib/utils";
import { EnumTag } from "@/components/common/enum-tag";
import { IconPicker } from "@/components/common/icon-picker";
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
import type { EnumKind, EnumOption } from "@/types/customer";

// Bảng màu preset cho tag (đọc được cả nền sáng lẫn tối).
const TAG_COLORS = [
  "#7b68ee", "#3b82f6", "#0ea5e9", "#14b8a6", "#22c55e", "#65a30d",
  "#ca8a04", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#6b7280",
];

// Trạng thái dialog: đang mở cho kind nào, sửa option nào (null = tạo mới).
type DialogState = { kind: EnumKind; option: EnumOption | null } | null;

// Mỗi trang /enums/[kind] render manager cho đúng 1 kind (page đã query + sort sẵn).
export function EnumsManager({
  kind,
  options,
}: {
  kind: EnumKind;
  options: EnumOption[];
}) {
  const t = useTranslations("enums");
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pending, start] = useTransition();

  const onDelete = (o: EnumOption) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    start(async () => {
      const res = await deleteOption(o.id, o.kind, o.value);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("deleteOk"));
      router.refresh();
    });
  };

  // Bật/tắt trực tiếp từ checkbox trong bảng (giữ nguyên các trường còn lại).
  const onToggleActive = (o: EnumOption) =>
    start(async () => {
      const res = await updateOption(o.id, {
        label_vi: o.label_vi,
        label_en: o.label_en,
        label_id: o.label_id,
        icon: o.icon,
        color: o.color,
        sort_order: o.sort_order,
        is_active: !o.is_active,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });

  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{t(`kind_${kind}`)}</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialog({ kind, option: null })}
        >
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">{t("colValue")}</TableHead>
              <TableHead>{t("colVi")}</TableHead>
              <TableHead>{t("colEn")}</TableHead>
              <TableHead>{t("colId")}</TableHead>
              <TableHead className="w-28 text-center">
                {t("colActive")}
              </TableHead>
              <TableHead className="w-28 text-right">
                {t("colActions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {options.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-16 text-center text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              options.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">
                    {o.value}
                  </TableCell>
                  <TableCell>
                    <EnumTag icon={o.icon} color={o.color} label={o.label_vi} />
                  </TableCell>
                  <TableCell>
                    {o.label_en ? (
                      <EnumTag icon={o.icon} color={o.color} label={o.label_en} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {o.label_id ? (
                      <EnumTag icon={o.icon} color={o.color} label={o.label_id} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-primary"
                      checked={o.is_active}
                      disabled={pending}
                      aria-label={t("colActive")}
                      title={o.is_active ? t("active") : t("inactive")}
                      onChange={() => onToggleActive(o)}
                    />
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      title={t("edit")}
                      aria-label={t("edit")}
                      disabled={pending}
                      onClick={() => setDialog({ kind, option: o })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title={t("delete")}
                      aria-label={t("delete")}
                      disabled={pending}
                      onClick={() => onDelete(o)}
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

      <OptionDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

const schema = z.object({
  value: z.string().min(1),
  label_vi: z.string().min(1),
  label_en: z.string(), // không bắt buộc — "" = chưa dịch, lưu null
  label_id: z.string(),
  icon: z.string(), // tên icon Lucide; "" = không icon
  color: z.string(), // hex #rrggbb; "" = không màu
  sort_order: z.string(), // input number trả string; convert khi submit
  is_active: z.boolean(),
});
type Values = z.infer<typeof schema>;

function OptionDialog({
  state,
  onClose,
  onDone,
}: {
  state: DialogState;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("enums");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const editing = state?.option ?? null;

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    // Khóa remount theo option/kind để form nạp lại giá trị đúng khi mở.
    values: {
      value: editing?.value ?? "",
      label_vi: editing?.label_vi ?? "",
      label_en: editing?.label_en ?? "",
      label_id: editing?.label_id ?? "",
      icon: editing?.icon ?? "",
      color: editing?.color ?? "",
      sort_order: String(editing?.sort_order ?? 0),
      is_active: editing?.is_active ?? true,
    },
  });

  // Xem trước tag theo giá trị đang nhập (nhãn theo locale hiện tại).
  const w = watch();
  const previewLabel =
    (locale === "en" ? w.label_en : locale === "id" ? w.label_id : w.label_vi) ||
    w.value ||
    "…";

  const onSubmit = (v: Values) =>
    start(async () => {
      if (!state) return;
      const sort_order = Number(v.sort_order) || 0;
      const res = editing
        ? await updateOption(editing.id, {
            label_vi: v.label_vi,
            label_en: v.label_en || null,
            label_id: v.label_id || null,
            icon: v.icon || null,
            color: v.color || null,
            sort_order,
            is_active: v.is_active,
          })
        : await createOption({
            kind: state.kind,
            value: v.value,
            label_vi: v.label_vi,
            label_en: v.label_en || null,
            label_id: v.label_id || null,
            icon: v.icon || null,
            color: v.color || null,
            sort_order,
            is_active: v.is_active,
          });
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
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("addTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("colValue")} error={errors.value && t("required")}>
              {/* value cố định sau khi tạo (đổi sẽ mồ côi customers). */}
              <Input
                {...register("value")}
                disabled={!!editing}
                placeholder="vd: new_lead"
                autoComplete="off"
              />
            </Field>
            <Field label={t("colSort")}>
              <Input type="number" {...register("sort_order")} />
            </Field>
            <Field label={t("colVi")} error={errors.label_vi && t("required")}>
              <Input {...register("label_vi")} />
            </Field>
            <Field label={t("colEn")}>
              <Input {...register("label_en")} placeholder={t("optional")} />
            </Field>
            <Field label={t("colId")}>
              <Input {...register("label_id")} placeholder={t("optional")} />
            </Field>
            <Field label={t("iconLabel")}>
              <Controller
                control={control}
                name="icon"
                render={({ field }) => (
                  <IconPicker
                    value={field.value || null}
                    onChange={(i) => field.onChange(i ?? "")}
                    placeholder={t("pickIcon")}
                    searchPlaceholder={t("searchIcon")}
                    clearLabel={t("clearIcon")}
                    emptyText={t("noIconResults")}
                    countText={(shown, total) =>
                      t("iconShown", { shown, total })
                    }
                  />
                )}
              />
            </Field>
          </div>

          <Field label={t("colorLabel")}>
            <Controller
              control={control}
              name="color"
              render={({ field }) => <ColorSwatches field={field} />}
            />
          </Field>

          {/* Xem trước + kích hoạt */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t("preview")}
              </span>
              <EnumTag
                icon={w.icon || null}
                color={w.color || null}
                label={previewLabel}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 cursor-pointer accent-primary"
                {...register("is_active")}
              />
              {t("activeLabel")}
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <RefreshCw className="animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Ô màu tròn: preset + "không màu" + màu tùy chỉnh (input color native ẩn bên trong).
const swatchCls =
  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const ringCls = "ring-2 ring-ring ring-offset-2 ring-offset-background";

function ColorSwatches({
  field,
}: {
  field: { value: string; onChange: (v: string) => void };
}) {
  const t = useTranslations("enums");
  const isCustom = !!field.value && !TAG_COLORS.includes(field.value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        title={t("clearColor")}
        aria-label={t("clearColor")}
        onClick={() => field.onChange("")}
        className={cn(
          swatchCls,
          "border-input bg-background text-muted-foreground",
          !field.value && ringCls,
        )}
      >
        <X className="size-3.5" />
      </button>

      {TAG_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={c}
          onClick={() => field.onChange(c)}
          className={cn(swatchCls, "border-foreground/10", field.value === c && ringCls)}
          style={{ backgroundColor: c }}
        >
          {field.value === c && (
            <Check className="size-3.5 text-white drop-shadow-sm" />
          )}
        </button>
      ))}

      <label
        title={t("customColor")}
        className={cn(
          swatchCls,
          "relative border-foreground/10 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
          isCustom && ringCls,
        )}
        style={
          isCustom
            ? { backgroundColor: field.value }
            : {
                background:
                  "conic-gradient(#ef4444,#f97316,#ca8a04,#22c55e,#0ea5e9,#7b68ee,#ec4899,#ef4444)",
              }
        }
      >
        {isCustom ? (
          <Check className="size-3.5 text-white drop-shadow-sm" />
        ) : (
          <Pipette className="size-3.5 text-white drop-shadow-sm" />
        )}
        <input
          type="color"
          aria-label={t("customColor")}
          value={field.value || "#7b68ee"}
          onChange={(e) => field.onChange(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
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
