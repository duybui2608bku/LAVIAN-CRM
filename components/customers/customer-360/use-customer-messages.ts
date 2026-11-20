"use client";

import { useQuery } from "@tanstack/react-query";
import { getCustomerMessages } from "@/app/(app)/appointments/actions";

/** Tin SMAX gần nhất của khách (đọc trực tiếp SMAX qua server) — dùng chung modal Tin nhắn + popup 360°. */
export function useCustomerMessages(customerId: string | null | undefined) {
  return useQuery({
    queryKey: ["smax-messages", customerId],
    enabled: !!customerId,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await getCustomerMessages(customerId!);
      if (res.error) throw new Error(res.error);
      return res.messages ?? [];
    },
  });
}
