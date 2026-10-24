"use client";

import { Button } from "antd";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import { useMounted } from "@/hooks/use-mounted";

export function ThemeToggle() {
  const t = useTranslations("theme");
  const { resolvedTheme, setTheme } = useTheme();
  // Chờ mount để tránh lệch hydration (server không biết theme của client).
  const mounted = useMounted();

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      type="text"
      aria-label={t("toggle")}
      title={t("toggle")}
      icon={isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    />
  );
}
