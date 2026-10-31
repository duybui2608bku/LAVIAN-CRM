"use client";

import { useEffect, useMemo } from "react";
import { App, ConfigProvider, theme, type ThemeConfig } from "antd";
import enUS from "antd/locale/en_US";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import "dayjs/locale/en";
import "dayjs/locale/vi";
import { useTheme } from "next-themes";

import { useMounted } from "@/hooks/use-mounted";
import type { Locale } from "@/i18n/config";
import { bindToast } from "@/lib/toast";

const ANTD_LOCALES = { vi: viVN, en: enUS } as const;

// Bảng màu dự án — cùng giá trị với biến CSS trong globals.css (Tailwind dùng
// biến CSS cho bố cục, antd dùng token này cho component).
const LIGHT = {
  colorPrimary: "#684fd4",
  colorSuccess: "#16834a",
  colorWarning: "#d97706",
  colorError: "#d92d20",
  colorInfo: "#2563eb",
  colorText: "#182230",
  colorTextSecondary: "#667085",
  colorBorder: "#cfd5df",
  colorBorderSecondary: "#dfe3ea",
  colorBgLayout: "#f6f7fb",
  colorBgContainer: "#ffffff",
};

const DARK = {
  colorPrimary: "#9b87f5",
  colorSuccess: "#48d58b",
  colorWarning: "#f6b94a",
  colorError: "#ff6b6b",
  colorInfo: "#72a7ff",
  colorText: "#edf0f5",
  colorTextSecondary: "#aab2c0",
  colorBorder: "#3b4454",
  colorBorderSecondary: "#303745",
  colorBgLayout: "#11151b",
  colorBgContainer: "#1a1f28",
  colorBgElevated: "#1f2530",
};

function buildTheme(dark: boolean): ThemeConfig {
  const c = dark ? DARK : LIGHT;
  return {
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      ...c,
      borderRadius: 4,
      fontSize: 14,
      fontFamily: "var(--font-inter), system-ui, sans-serif",
      fontFamilyCode: "var(--font-geist-mono), monospace",
      controlHeight: 32,
    },
    components: {
      Layout: {
        bodyBg: c.colorBgLayout,
        headerBg: c.colorBgContainer,
        siderBg: c.colorBgContainer,
        headerPadding: "0 16px",
        headerHeight: 56,
      },
      Menu: { itemBorderRadius: 4, activeBarBorderWidth: 0 },
      Form: { itemMarginBottom: 16, verticalLabelPadding: "0 0 4px" },
      Table: { headerBg: dark ? "#202632" : "#f3f4f8", cellPaddingBlock: 10 },
    },
  };
}

/** Gắn `message` của <App> vào `toast` dùng chung. */
function ToastBridge() {
  const { message } = App.useApp();
  useEffect(() => bindToast(message), [message]);
  return null;
}

export function AntdProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  // Chờ mount mới đọc theme để server/client render cùng một cây (tránh lệch hydration).
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";

  const themeConfig = useMemo(() => buildTheme(dark), [dark]);
  dayjs.locale(locale);

  return (
    <ConfigProvider theme={themeConfig} locale={ANTD_LOCALES[locale]}>
      <App>
        <ToastBridge />
        {children}
      </App>
    </ConfigProvider>
  );
}
