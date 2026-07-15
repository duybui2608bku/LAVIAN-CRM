"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, KeyRound, RefreshCw, Search, ShieldCheck, UserPlus } from "lucide-react";

import { createUser, resetPassword, setUserStatus } from "@/app/(app)/users/actions";
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
import type { Profile } from "@/types/user";

export function UsersManager({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const t = useTranslations("users");
  const router = useRouter();
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

  const toggleBan = (p: Profile) => {
    const next = p.status === "banned" ? "active" : "banned";
    start(async () => {
      const res = await setUserStatus(p.id, next);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(next === "banned" ? t("bannedOk") : t("unbannedOk"));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="size-4" />
          {t("create")}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colEmail")}</TableHead>
              <TableHead>{t("colRole")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colCreated")}</TableHead>
              <TableHead className="text-right">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
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

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onDone={() => router.refresh()}
      />
      <ResetPasswordDialog
        target={resetTarget}
        onClose={() => setResetTarget(null)}
      />
    </div>
  );
}

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  user_name: z.string().min(1),
  avatar_url: z.string().url().optional().or(z.literal("")),
  isAdmin: z.boolean().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

function CreateUserDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
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
    defaultValues: { isAdmin: false, avatar_url: "" },
  });

  const onSubmit = (v: CreateValues) =>
    start(async () => {
      const res = await createUser({
        email: v.email,
        password: v.password,
        user_name: v.user_name,
        avatar_url: v.avatar_url || undefined,
        role: v.isAdmin ? "admin" : "user",
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("createOk"));
      reset();
      onOpenChange(false);
      onDone();
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
          <Field label={t("avatarUrl")}>
            <ImageUpload
              value={watch("avatar_url") || null}
              onChange={(url) => setValue("avatar_url", url ?? "")}
              folder="avatars"
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
