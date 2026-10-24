import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * `false` khi SSR + lượt hydrate đầu, `true` sau đó — để đọc giá trị chỉ có ở
 * client (theme next-themes) mà không lệch hydration, không setState trong effect.
 */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}
