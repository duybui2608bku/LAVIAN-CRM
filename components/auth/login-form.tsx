"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean(),
});
type Values = z.infer<typeof schema>;

// ponytail: "ghi nhớ đăng nhập" = lưu email+mật khẩu plaintext trong
// localStorage để prefill — máy dùng chung thì bỏ tick lúc đăng nhập.
const CREDS_KEY = "lavian-login";

function savedCreds(): { email: string; password: string } | null {
  try {
    return JSON.parse(localStorage.getItem(CREDS_KEY) ?? "null");
  } catch {
    return null; // SSR (không có localStorage) hoặc JSON hỏng
  }
}

export function LoginForm() {
  const t = useTranslations("auth");
  const [pending, start] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    // RHF đổ defaultValues vào input qua ref sau mount → không lệch hydration.
    defaultValues: { remember: true, email: "", password: "", ...savedCreds() },
  });

  const onSubmit = (values: Values) =>
    start(async () => {
      // Lưu TRƯỚC khi gọi signIn — thành công sẽ redirect ngay.
      if (values.remember)
        localStorage.setItem(
          CREDS_KEY,
          JSON.stringify({ email: values.email, password: values.password }),
        );
      else localStorage.removeItem(CREDS_KEY);
      const res = await signIn({ email: values.email, password: values.password });
      if (res?.error) toast.error(res.error);
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{t("emailInvalid")}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{t("password")}</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="pr-10"
            {...register("password")}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-destructive">{t("passwordRequired")}</p>
        )}
      </div>

      <label className="flex w-fit items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          {...register("remember")}
        />
        {t("rememberMe")}
      </label>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
      </Button>
    </form>
  );
}
