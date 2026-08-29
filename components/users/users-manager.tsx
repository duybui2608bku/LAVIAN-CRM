"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, KeyRound, RefreshCw, Search, ShieldCheck, UserPlus } from "lucide-react";

import {
  createUser,
  resetPassword,
  setUserDepartment,
  setUserStatus,
} from "@/app/(app)/users/actions";
import { ClearableSelect } from "@/components/common/clearable-select";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageUpload } from "@/components/common/image-upload";
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
import type { Profile, UserDepartment } from "@/types/user";

const DEPARTMENTS: UserDepartment[] = ["customer_care", "technician", "sales"];

export function UsersManager({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const t = useTranslations("users");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.user_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q),
    );
  }, [profiles, query]);

  const departmentOptions = DEPARTMENTS.map((d) => ({
    value: d,
    label: t(`dept_${d}`),
  }));

  const changeDepartment = (p: Profile, value: string) =>
    start(async () => {
      const res = await setUserDepartment(
        p.id,
        (value || null) as UserDepartment | null,
      );
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("departmentOk"));
    });

  const toggleBan = (p: Profile) => {
    const next = p.status === "banned" ? "active" : "banned";
    start(async () => {
      const res = await setUserStatus(p.id, next);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(next === "banned" ? t("bannedOk") : t("unbannedOk"));
    });
  };

  return (
    <Page>
      <PageHeader
        title={t("title")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="size-4" />
            {t("create")}
          </Button>
        }
      />

      <PageToolbar>
        <div className="relative w-full sm:max-w-[220px]">
          <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </PageToolbar>

      <div className="surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colEmail")}</TableHead>
              <TableHead>{t("colRole")}</TableHead>
              <TableHead>{t("colDepartment")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colCreated")}</TableHead>
              <TableHead className="text-right">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.user_name || "—"}
                  </TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>
                    <Badge variant={p.role === "admin" ? "default" : "outline"}>
                      {t(`role_${p.role}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ClearableSelect
                      value={p.department ?? ""}
                      onValueChange={(v) => changeDepartment(p, v)}
                      options={departmentOptions}
                      placeholder="—"
                      clearLabel={t("clearDepartment")}
                      ariaLabel={t("colDepartment")}
                      className="w-full min-w-[160px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        p.status === "banned" ? "destructive" : "secondary"
                      }
                    >
                      {t(`status_${p.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      title={t("resetPassword")}
                      aria-label={t("resetPassword")}
                      disabled={pending}
                      onClick={() => setResetTarget(p)}
                    >
                      <KeyRound className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title={p.status === "banned" ? t("unban") : t("ban")}
                      aria-label={p.status === "banned" ? t("unban") : t("ban")}
                      disabled={pending || p.id === currentUserId}
                      onClick={() => toggleBan(p)}
                    >
                      {p.status === "banned" ? (
                        <ShieldCheck className="size-4 text-success" />
                      ) : (
                        <Ban className="size-4 text-destructive" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ResetPasswordDialog
        target={resetTarget}
        onClose={() => setResetTarget(null)}
      />
    </Page>
  );
}

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  user_name: z.string().min(1),
  avatar_url: z.string().url().optional().or(z.literal("")),
  department: z.string().optional(),
  isAdmin: z.boolean().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("users");
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { isAdmin: false, avatar_url: "", department: "" },
  });

  const onSubmit = (v: CreateValues) =>
    start(async () => {
      const res = await createUser({
        email: v.email,
        password: v.password,
        user_name: v.user_name,
        avatar_url: v.avatar_url || undefined,
        role: v.isAdmin ? "admin" : "user",
        department: (v.department || null) as UserDepartment | null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("createOk"));
      reset();
      onOpenChange(false);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field
            label={t("colEmail")}
            error={errors.email && t("emailInvalid")}
          >
            <Input type="email" autoComplete="off" {...register("email")} />
          </Field>
          <Field
            label={t("newPassword")}
            error={errors.password && t("passwordMin")}
          >
            <Input type="password" autoComplete="new-password" {...register("password")} />
          </Field>
          <Field
            label={t("colName")}
            error={errors.user_name && t("nameRequired")}
          >
            <Input {...register("user_name")} />
          </Field>
          <Field label={t("colDepartment")}>
            <ClearableSelect
              value={watch("department") ?? ""}
              onValueChange={(v) => setValue("department", v)}
              options={DEPARTMENTS.map((d) => ({
                value: d,
                label: t(`dept_${d}`),
              }))}
              placeholder="—"
              clearLabel={t("clearDepartment")}
              ariaLabel={t("colDepartment")}
            />
          </Field>
          <Field label={t("avatarUrl")}>
            <ImageUpload
              value={watch("avatar_url") || null}
              onChange={(url) => setValue("avatar_url", url ?? "")}
              className="mx-auto rounded-full"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" {...register("isAdmin")} />
            {t("makeAdmin")}
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <RefreshCw className="animate-spin" />}
              {t("createSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const resetSchema = z.object({ password: z.string().min(6) });
type ResetValues = z.infer<typeof resetSchema>;

function ResetPasswordDialog({
  target,
  onClose,
}: {
  target: Profile | null;
  onClose: () => void;
}) {
  const t = useTranslations("users");
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });

  const onSubmit = (v: ResetValues) =>
    start(async () => {
      if (!target) return;
      const res = await resetPassword(target.id, v.password);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("resetOk"));
      reset();
      onClose();
    });

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("resetTitle")}</DialogTitle>
          <DialogDescription>{target?.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field
            label={t("newPassword")}
            error={errors.password && t("passwordMin")}
          >
            <Input type="password" autoComplete="new-password" {...register("password")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <RefreshCw className="animate-spin" />}
              {t("resetSubmit")}
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
