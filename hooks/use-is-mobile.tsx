"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

import type { UiHints } from "@/lib/ui-hints";

/** Gợi ý từ User-Agent (root layout) — dùng cho SSR + lượt hydrate để không lệch. */
export const UiHintContext = createContext<Pick<UiHints, "mobile" | "touch">>({ mobile: false, touch: false });

function useMedia(query: string, serverHint: boolean) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverHint,
  );
}

/** `true` khi màn hình hẹp hơn `sm` (640px, khớp Tailwind) — để đổi hẳn cách render (bảng → thẻ). */
export function useIsMobile() {
  return useMedia("(max-width: 639px)", useContext(UiHintContext).mobile);
}

/** `true` trên thiết bị cảm ứng (`pointer: coarse`) — control to hơn, không bật bàn phím cho ô ngày. */
export function useIsTouch() {
  return useMedia("(pointer: coarse)", useContext(UiHintContext).touch);
}
