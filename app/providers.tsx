"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
    >
      <UiHintContext value={hints}>
        <AntdProvider locale={locale} hints={hints}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </AntdProvider>
      </UiHintContext>
    </ThemeProvider>
  );
}
