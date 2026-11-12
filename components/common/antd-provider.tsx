"use client";

import { useEffect, useMemo } from "react";
import { App, ConfigProvider, theme, type ThemeConfig } from "antd";
import enUS from "antd/locale/en_US";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import "dayjs/locale/en";
import "dayjs/locale/vi";
import { useTheme } from "next-themes";

import { useIsTouch } from "@/hooks/use-is-mobile";
import { useMounted } from "@/hooks/use-mounted";
import type { Locale } from "@/i18n/config";
import { bindToast } from "@/lib/toast";
import { THEME_BG, THEME_COOKIE, type UiHints } from "@/lib/ui-hints";

const ANTD_LOCALES = { vi: viVN, en: enUS } as const;

// Bảng màu dự án — cùng giá trị với biến CSS trong globals.css (Tailwind dùng
// biến CSS cho bố cục, antd dùng token này cho component).
const LIGHT = {
  colorPrimary: "#684fd4",
  colorSuccess: "#16834a",
  colorWarning: "#d97706",
  colorError: "#d92d20",
  colorInfo: "#2563eb",
  colorText: "#18181b",
  colorTextSecondary: "#71717a",
  colorBorder: "#dcdce3",
  colorBorderSecondary: "#e7e7ec",
  colorBgLayout: "#f7f7f9",
  colorBgContainer: "#ffffff",
  colorFillTertiary: "#f1f1f4",
};

const DARK = {
  colorPrimary: "#9b87f5",
  colorSuccess: "#48d58b",
  colorWarning: "#f6b94a",
  colorError: "#ff6b6b",
  colorInfo: "#72a7ff",
  colorText: "#ececf1",
  colorTextSecondary: "#a1a1aa",
  colorBorder: "#34343c",
  colorBorderSecondary: "#2a2a31",
  colorBgLayout: "#0f0f12",
  colorBgContainer: "#18181c",
  colorBgElevated: "#1f1f24",
  colorFillTertiary: "#232329",
};

function buildTheme(dark: boolean, touch: boolean): ThemeConfig {
  const c = dark ? DARK : LIGHT;
  return {
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      ...c,
      borderRadius: 8,
      borderRadiusSM: 6,
      borderRadiusLG: 12,
      fontSize: 14,
      fontFamily: "var(--font-system)",
      fontFamilyCode: "var(--font-geist-mono), monospace",
      // Cảm ứng: control 40px cho dễ chạm (antd tự suy ra padding/size).
      controlHeight: touch ? 40 : 34,
      boxShadowSecondary: dark
        ? "0 8px 24px rgb(0 0 0 / 0.45)"
        : "0 8px 24px rgb(24 24 27 / 0.08), 0 1px 2px rgb(24 24 27 / 0.06)",
    },
    components: {
      Layout: {
        bodyBg: c.colorBgLayout,
        headerBg: c.colorBgContainer,
        siderBg: c.colorBgContainer,
        headerPadding: "0 12px",
        headerHeight: 52,
      },
      Menu: {
        itemBorderRadius: 6,
        activeBarBorderWidth: 0,
        itemHeight: touch ? 44 : 36,
        itemMarginInline: 8,
        itemMarginBlock: 2,
        itemBg: "transparent",
        itemColor: c.colorTextSecondary,
        itemHoverColor: c.colorText,
        itemSelectedBg: dark ? "#2a2540" : "#f0edfc",
        itemSelectedColor: c.colorPrimary,
        groupTitleColor: c.colorTextSecondary,
        groupTitleFontSize: 12,
      },
      Button: { primaryShadow: "none", defaultShadow: "none", dangerShadow: "none" },
      Form: { itemMarginBottom: 16, verticalLabelPadding: "0 0 6px" },
      Table: {
        headerBg: c.colorBgContainer,
        headerColor: c.colorTextSecondary,
        headerSplitColor: "transparent",
        headerSortActiveBg: c.colorFillTertiary,
        headerSortHoverBg: c.colorFillTertiary,
        rowHoverBg: dark ? "#1f1f25" : "#fafafb",
        borderColor: c.colorBorderSecondary,
        cellPaddingBlock: 12,
        cellPaddingInline: 14,
        cellPaddingBlockSM: 8,
      },
      Drawer: { footerPaddingBlock: 12, footerPaddingInline: 24 },
      Tag: { defaultBg: c.colorFillTertiary },
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
  hints,
  children,
}: {
  locale: Locale;
  hints: UiHints;
  children: React.ReactNode;
}) {
  // forcedTheme (vd /lead-form) không đổi resolvedTheme của next-themes → ưu tiên nó.
  const { resolvedTheme: stored, forcedTheme } = useTheme();
  const resolvedTheme = forcedTheme ?? stored;
  // Trước mount dùng gợi ý từ cookie (server và lượt hydrate cùng giá trị → không lệch,
  // không nháy sáng); sau mount theo next-themes.
  const mounted = useMounted();
  const dark = mounted ? resolvedTheme === "dark" : !!hints.dark;
  const touch = useIsTouch();

  // Ghi theme đã áp dụng cho lần SSR sau + đổi màu thanh trạng thái điện thoại.
  useEffect(() => {
    if (!resolvedTheme) return;
    const isDark = resolvedTheme === "dark";
    // Theme ép buộc không phải lựa chọn của người dùng → không ghi cookie.
    if (!forcedTheme)
      document.cookie = `${THEME_COOKIE}=${isDark ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.setAttribute("content", isDark ? THEME_BG.dark : THEME_BG.light);
    });
  }, [resolvedTheme, forcedTheme]);

  const themeConfig = useMemo(() => buildTheme(dark, touch), [dark, touch]);
  dayjs.locale(locale);

  return (
    // Cảm ứng: tắt virtual list — rc-virtual-list tự cuộn bằng JS khi vuốt nên
    // dropdown dài bị giật; danh sách thường chỉ vài trăm dòng nên cuộn native đủ nhanh.
    <ConfigProvider theme={themeConfig} locale={ANTD_LOCALES[locale]} virtual={!touch}>
      <App>
        <ToastBridge />
        {children}
      </App>
    </ConfigProvider>
  );
}
