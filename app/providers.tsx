"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import { AntdProvider } from "@/components/common/antd-provider";
import { UiHintContext } from "@/hooks/use-is-mobile";
import type { Locale } from "@/i18n/config";
import type { UiHints } from "@/lib/ui-hints";

// Global client-side providers. One QueryClient per browser session
// (useState keeps it stable across re-renders; a fresh one per request on the server).
export function Providers({
  locale,
  hints,
  children,
}: {
  locale: Locale;
  hints: UiHints;
  children: React.ReactNode;
}) {
  // /lead-form (iframe SMAX) luôn sáng, không có nút đổi theme. forcedTheme không
  // ghi đè lựa chọn đã lưu của người dùng CRM.
  const forcedTheme = usePathname().startsWith("/lead-form") ? "light" : undefined;
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000 } },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      // Mặc định sáng, không theo theme hệ thống; người dùng tự bật tối trong menu tài khoản.
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      forcedTheme={forcedTheme}
    >
      <UiHintContext value={hints}>
        <AntdProvider locale={locale} hints={forcedTheme ? { ...hints, dark: false } : hints}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </AntdProvider>
      </UiHintContext>
    </ThemeProvider>
  );
}
