"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import {
  createService,
  deleteService,
  updateService,
} from "@/app/(app)/services/actions";
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
import type { Service } from "@/types/service";

// Trạng thái dialog: null = đóng; service null = tạo mới.
type DialogState = { service: Service | null } | null;

export function ServicesManager({ services }: { services: Service[] }) {
  const t = useTranslations("services");
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pending, start] = useTransition();

  const onDelete = (s: Service) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    start(async () => {
      const res = await deleteService(s.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("deleteOk"));
      router.refresh();
    });
  };

  // Bật/tắt trực tiếp từ checkbox trong bảng (giữ nguyên các trường còn lại).
  const onToggleActive = (s: Service) =>
    start(async () => {
      const res = await updateService(s.id, {
        name_vi: s.name_vi,
        name_en: s.name_en,
        name_id: s.name_id,
        sort_order: s.sort_order,
        is_active: !s.is_active,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialog({ service: null })}
        >
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
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
            {services.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-16 text-center text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="truncate">{s.name_vi}</TableCell>
                  <TableCell className="truncate">
                    {s.name_en || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="truncate">
                    {s.name_id || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-primary"
                      checked={s.is_active}
                      disabled={pending}
                      aria-label={t("colActive")}
                      title={s.is_active ? t("active") : t("inactive")}
                      onChange={() => onToggleActive(s)}
                    />
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      title={t("edit")}
                      aria-label={t("edit")}
                      disabled={pending}
                      onClick={() => setDialog({ service: s })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title={t("delete")}
                      aria-label={t("delete")}
                      disabled={pending}
                      onClick={() => onDelete(s)}
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

      <ServiceDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

const schema = z.object({
  name_vi: z.string().min(1),
  name_en: z.string(), // không bắt buộc — "" = chưa dịch, lưu null
  name_id: z.string(),
  sort_order: z.string(), // input number trả string; convert khi submit
  is_active: z.boolean(),
});
type Values = z.infer<typeof schema>;

function ServiceDialog({
  state,
  onClose,
  onDone,
}: {
  state: DialogState;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("services");
  const [pending, start] = useTransition();
  const editing = state?.service ?? null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    // Khóa remount theo service để form nạp lại giá trị đúng khi mở.
    values: {
      name_vi: editing?.name_vi ?? "",
      name_en: editing?.name_en ?? "",
      name_id: editing?.name_id ?? "",
      sort_order: String(editing?.sort_order ?? 0),
      is_active: editing?.is_active ?? true,
    },
  });

  const onSubmit = (v: Values) =>
    start(async () => {
      if (!state) return;
      const input = {
        name_vi: v.name_vi,
        name_en: v.name_en || null,
        name_id: v.name_id || null,
        sort_order: Number(v.sort_order) || 0,
        is_active: v.is_active,
      };
      const res = editing
        ? await updateService(editing.id, input)
        : await createService(input);
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
            <Field label={t("colVi")} error={errors.name_vi && t("required")}>
              <Input {...register("name_vi")} />
            </Field>
            <Field label={t("colEn")}>
              <Input {...register("name_en")} placeholder={t("optional")} />
            </Field>
            <Field label={t("colId")}>
              <Input {...register("name_id")} placeholder={t("optional")} />
            </Field>
            <Field label={t("colSort")}>
              <Input type="number" {...register("sort_order")} />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 cursor-pointer accent-primary"
              {...register("is_active")}
            />
            {t("activeLabel")}
          </label>

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
