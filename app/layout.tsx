import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Geist_Mono, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { userAgentFromString } from "next/server";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import type { Locale } from "@/i18n/config";
import { THEME_BG, THEME_COOKIE, type UiHints } from "@/lib/ui-hints";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LAVIAN CRM",
  description: "Hệ thống CRM LAVIAN",
};

async function getUiHints(): Promise<UiHints> {
  const [cookieStore, h] = await Promise.all([cookies(), headers()]);
  const theme = cookieStore.get(THEME_COOKIE)?.value;
  const { device } = userAgentFromString(h.get("user-agent") ?? undefined);
  return {
    dark: theme === "dark" ? true : theme === "light" ? false : undefined,
    touch: device.type === "mobile" || device.type === "tablet",
    mobile: device.type === "mobile",
  };
}

// Thanh trạng thái điện thoại cùng màu nền app. Đã biết theme (cookie) → 1 màu;
// chưa biết → theo theme hệ thống. AntdProvider cập nhật lại khi đổi theme.
export async function generateViewport(): Promise<Viewport> {
  const { dark } = await getUiHints();
  return {
    themeColor: dark === undefined
      ? [
          { media: "(prefers-color-scheme: light)", color: THEME_BG.light },
          { media: "(prefers-color-scheme: dark)", color: THEME_BG.dark },
        ]
      : dark ? THEME_BG.dark : THEME_BG.light,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, hints] = await Promise.all([getLocale() as Promise<Locale>, getUiHints()]);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextTopLoader color="var(--primary)" height={2} showSpinner={false} />
        {/* layer: style antd vào `@layer antd` (thứ tự khai ở globals.css) */}
        <AntdRegistry layer>
          <NextIntlClientProvider>
            <Providers locale={locale} hints={hints}>{children}</Providers>
          </NextIntlClientProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
