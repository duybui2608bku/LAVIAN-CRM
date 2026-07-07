"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { createOption, deleteOption, updateOption } from "@/app/(app)/enums/actions";
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
import type { EnumKind, EnumOption } from "@/types/customer";

const KINDS: EnumKind[] = ["stage", "source", "lost_reason"];

// Trạng thái dialog: đang mở cho kind nào, sửa option nào (null = tạo mới).
type DialogState = { kind: EnumKind; option: EnumOption | null } | null;

export function EnumsManager({ options }: { options: EnumOption[] }) {
  const t = useTranslations("enums");
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pending, start] = useTransition();

  const byKind = (k: EnumKind) =>
    options
      .filter((o) => o.kind === k)
      .sort((a, b) => a.sort_order - b.sort_order);

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

  return (
    <div className="flex flex-1 flex-col gap-8 p-4">
      <h1 className="text-lg font-semibold">{t("title")}</h1>

      {KINDS.map((kind) => (
        <section key={kind} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-medium">{t(`kind_${kind}`)}</h2>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colValue")}</TableHead>
                  <TableHead>{t("colVi")}</TableHead>
                  <TableHead>{t("colEn")}</TableHead>
                  <TableHead>{t("colId")}</TableHead>
                  <TableHead className="text-center">{t("colSort")}</TableHead>
                  <TableHead className="text-center">{t("colActive")}</TableHead>
                  <TableHead className="text-right">{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byKind(kind).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-16 text-center text-muted-foreground"
                    >
                      {t("empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  byKind(kind).map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">
                        {o.value}
                      </TableCell>
                      <TableCell>{o.label_vi}</TableCell>
                      <TableCell>{o.label_en}</TableCell>
                      <TableCell>{o.label_id}</TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {o.sort_order}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={o.is_active ? "secondary" : "outline"}>
                          {o.is_active ? t("active") : t("inactive")}
                        </Badge>
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
        </section>
      ))}

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
  label_en: z.string().min(1),
  label_id: z.string().min(1),
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
  const [pending, start] = useTransition();
  const editing = state?.option ?? null;

  const {
    register,
    handleSubmit,
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
      sort_order: String(editing?.sort_order ?? 0),
      is_active: editing?.is_active ?? true,
    },
  });

  const onSubmit = (v: Values) =>
    start(async () => {
      if (!state) return;
      const sort_order = Number(v.sort_order) || 0;
      const res = editing
        ? await updateOption(editing.id, {
            label_vi: v.label_vi,
            label_en: v.label_en,
            label_id: v.label_id,
            sort_order,
            is_active: v.is_active,
          })
        : await createOption({
            kind: state.kind,
            value: v.value,
            label_vi: v.label_vi,
            label_en: v.label_en,
            label_id: v.label_id,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("addTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label={t("colValue")} error={errors.value && t("required")}>
            {/* value cố định sau khi tạo (đổi sẽ mồ côi customers). */}
            <Input
              {...register("value")}
              disabled={!!editing}
              placeholder="vd: new_lead"
              autoComplete="off"
            />
          </Field>
          <Field label={t("colVi")} error={errors.label_vi && t("required")}>
            <Input {...register("label_vi")} />
          </Field>
          <Field label={t("colEn")} error={errors.label_en && t("required")}>
            <Input {...register("label_en")} />
          </Field>
          <Field label={t("colId")} error={errors.label_id && t("required")}>
            <Input {...register("label_id")} />
          </Field>
          <Field label={t("colSort")}>
            <Input type="number" {...register("sort_order")} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" {...register("is_active")} />
            {t("activeLabel")}
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : t("save")}
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
