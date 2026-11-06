"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

// Khớp breakpoint `sm` của Tailwind: < 640px là điện thoại.
const QUERY = "(max-width: 639px)";

/** Gợi ý từ User-Agent (root layout) — dùng cho SSR + lượt hydrate để không lệch. */
export const MobileHintContext = createContext(false);

const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** `true` khi màn hình hẹp hơn `sm` — để đổi hẳn cách render (bảng → thẻ). */
export function useIsMobile() {
  const hint = useContext(MobileHintContext);
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => hint);
}
