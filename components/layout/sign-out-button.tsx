"use client";

import { Button } from "antd";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

import { ConfirmAction } from "@/components/common/confirm-action";
import { signOut } from "@/lib/actions/auth";

/** Nút đăng xuất — hỏi xác nhận trước khi thực thi server action `signOut`. */
export function SignOutButton() {
  const t = useTranslations("auth");

  return (
    <ConfirmAction
      title={t("signOutConfirmTitle")}
      description={t("signOutConfirmBody")}
      okText={t("signOut")}
      cancelText={t("cancel")}
      onConfirm={() => signOut()}
    >
      <Button
        type="text"
        title={t("signOut")}
        aria-label={t("signOut")}
        icon={<LogOut className="size-4" />}
      />
    </ConfirmAction>
  );
}
