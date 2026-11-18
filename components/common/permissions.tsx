"use client";

import { createContext, useContext } from "react";

import type { Permission } from "@/lib/permissions";

// Quyền của user đang đăng nhập (AppShell cấp) — chỉ để ẩn nút; server action vẫn kiểm tra lại.
const PermissionsContext = createContext<readonly Permission[]>([]);

export const PermissionsProvider = PermissionsContext.Provider;

/** `const can = useCan(); can("customers.delete")` */
export function useCan() {
  const permissions = useContext(PermissionsContext);
  return (key: Permission) => permissions.includes(key);
}

// Id user đang đăng nhập (AppShell cấp) — mặc định người phụ trách lịch nhắc, lọc "Của tôi".
const CurrentUserContext = createContext<string | null>(null);

export const CurrentUserProvider = CurrentUserContext.Provider;

export function useCurrentUserId() {
  return useContext(CurrentUserContext);
}
