"use client";

import { useTopLoader } from "nextjs-toploader";
import { useTransition } from "react";

import { setLocale } from "@/i18n/actions";
import type { Locale } from "@/i18n/config";

/**
 * Đổi ngôn ngữ chạy revalidatePath("/", "layout") → re-render toàn bộ server
 * components, khá lâu. Chạy thanh top-loader để có phản hồi trực quan.
 */
export function useSwitchLocale() {
  const loader = useTopLoader();
  const [pending, startTransition] = useTransition();
  const switchTo = (v: Locale) =>
    startTransition(async () => {
      loader.start();
      try {
        await setLocale(v);
      } finally {
        loader.done();
      }
    });
  return { pending, switchTo };
}
