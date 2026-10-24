import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Geist_Mono, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import type { Locale } from "@/i18n/config";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;

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
            <Providers locale={locale}>{children}</Providers>
          </NextIntlClientProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
