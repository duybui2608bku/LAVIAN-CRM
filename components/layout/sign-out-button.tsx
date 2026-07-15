"use client";

import { useTransition } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Nút đăng xuất — hỏi xác nhận trước khi thực thi server action `signOut`. */
export function SignOutButton() {
  const t = useTranslations("auth");
  const [pending, start] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={t("signOut")}
          aria-label={t("signOut")}
        >
          <LogOut className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("signOutConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("signOutConfirmBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              start(() => {
                void signOut();
              });
            }}
          >
            {pending && <RefreshCw className="animate-spin" />}
            {t("signOut")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
