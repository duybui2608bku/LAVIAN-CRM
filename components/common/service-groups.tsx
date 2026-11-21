"use client";

import { createContext, useContext, useMemo } from "react";

import type { ServiceGroup } from "@/types/service";

// Nhóm dịch vụ (bảng service_groups) nạp 1 lần ở layout, dùng ở mọi form/bảng.
const Ctx = createContext<ServiceGroup[]>([]);

export function ServiceGroupsProvider({ groups, children }: { groups: ServiceGroup[]; children: React.ReactNode }) {
  return <Ctx.Provider value={groups}>{children}</Ctx.Provider>;
}

export function useServiceGroups() {
  const groups = useContext(Ctx);
  return useMemo(() => {
    const byId = new Map(groups.map((g) => [g.id, g.name]));
    const name = (id: string) => byId.get(id) ?? id;
    return {
      groups,
      /** Option cho Select (chỉ nhóm đang kích hoạt). */
      options: groups.filter((g) => g.is_active).map((g) => ({ value: g.id, label: g.name })),
      name,
      /** "Alis, Laser" — không có nhóm → "". */
      label: (ids?: readonly string[] | null) => (ids ?? []).map(name).join(", "),
    };
  }, [groups]);
}
