"use client";

import { useState, useTransition } from "react";
import { Button, Tree, type TreeProps } from "antd";
import { useTranslations } from "next-intl";
import {
  Briefcase,
  CalendarDays,
  ChartColumn,
  Crown,
  Headset,
  Megaphone,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

import { saveDepartmentPermissions } from "@/app/(app)/users/actions";
import { Page, PageHeader } from "@/components/layout/page";
import {
  ALL_PERMISSIONS,
  MODULES,
  PERMISSION_MODULES,
  effectivePermissions,
  normalizePermissions,
  type PermissionModule,
} from "@/lib/permissions";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { DEPARTMENTS, type UserDepartment } from "@/types/user";

type Values = Record<string, string[]>;

// Icon module trùng với menu sidebar (components/layout/app-shell.tsx).
const MODULE_ICONS: Record<PermissionModule, typeof Users> = {
  customers: Users,
  appointments: CalendarDays,
  tour: Wallet,
  services: Briefcase,
  reports: ChartColumn,
  marketing: Megaphone,
};
const DEPARTMENT_ICONS: Record<UserDepartment, typeof Users> = {
  customer_care: Headset,
  customer_care_leader: Crown,
  technician: Wrench,
  sales: TrendingUp,
};

const same = (a: readonly string[], b: readonly string[]) => a.join() === b.join();

/**
 * Trang phân quyền: trái = danh sách bộ phận, phải = cây menu → Xem / Thêm-Sửa / Xoá.
 * Sửa nháp nhiều bộ phận rồi lưu 1 lần; chấm màu = bộ phận có thay đổi chưa lưu.
 */
export function PermissionsEditor({ initial, members }: { initial: Values; members: Record<string, number> }) {
  const t = useTranslations("users");
  const tNav = useTranslations("nav");
  // Đưa về thứ tự chuẩn để so sánh thay đổi (DB lưu thứ tự bất kỳ).
  const saved = Object.fromEntries(DEPARTMENTS.map((d) => [d, effectivePermissions(null, initial[d])])) as Values;
  const [draft, setDraft] = useState<Values>(saved);
  const [current, setCurrent] = useState<UserDepartment>(DEPARTMENTS[0]);
  const [pending, start] = useTransition();

  const dirty = DEPARTMENTS.filter((d) => !same(draft[d], saved[d]));
  const checked = draft[current];
  const set = (keys: string[]) => setDraft((v) => ({ ...v, [current]: normalizePermissions(v[current], keys) }));

  const treeData: TreeProps["treeData"] = MODULES.map((m) => {
    const Icon = MODULE_ICONS[m];
    const actions = PERMISSION_MODULES[m];
    const count = actions.filter((a) => checked.includes(`${m}.${a}`)).length;
    return {
      key: m,
      title: (
        <span className="flex items-center gap-2 py-0.5">
          <Icon className="size-4 text-muted-foreground" />
          <span className="font-medium">{tNav(m)}</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {count}/{actions.length}
          </span>
        </span>
      ),
      children: actions.map((a) => ({
        key: `${m}.${a}`,
        title: (
          <span className="flex flex-wrap items-baseline gap-x-2 py-0.5">
            <span>{t(`perm_${a}`)}</span>
            <span className="text-xs text-muted-foreground">{t(`perm_${a}_desc`)}</span>
          </span>
        ),
      })),
    };
  });

  const save = () =>
    start(async () => {
      const res = await saveDepartmentPermissions(Object.fromEntries(dirty.map((d) => [d, draft[d]])));
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("permissionsOk"));
    });

  return (
    <Page>
      <PageHeader title={t("permissionsTitle")} description={t("permissionsHint")} />

      <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)] md:items-start">
        <nav aria-label={t("colDepartment")} className="surface flex flex-col gap-1 p-2">
          {DEPARTMENTS.map((d) => {
            const Icon = DEPARTMENT_ICONS[d];
            const active = d === current;
            return (
              <button
                key={d}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => setCurrent(d)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                  active ? "bg-primary/8 text-primary" : "hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md",
                    active ? "bg-primary/12" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t(`dept_${d}`)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("memberCount", { n: members[d] ?? 0 })}
                  </span>
                </span>
                {dirty.includes(d) ? (
                  <span className="size-2 shrink-0 rounded-full bg-primary" title={t("unsavedDot")} />
                ) : null}
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {draft[d].length}/{ALL_PERMISSIONS.length}
                </span>
              </button>
            );
          })}
        </nav>

        <section className="surface flex min-w-0 flex-col">
          <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold">{t(`dept_${current}`)}</h2>
              <p className="text-xs text-muted-foreground">
                {t("selectedCount", { n: checked.length, total: ALL_PERMISSIONS.length })}
              </p>
            </div>
            <Button size="small" disabled={checked.length === ALL_PERMISSIONS.length} onClick={() => set(ALL_PERMISSIONS)}>
              {t("selectAll")}
            </Button>
            <Button size="small" disabled={!checked.length} onClick={() => setDraft((v) => ({ ...v, [current]: [] }))}>
              {t("clearAll")}
            </Button>
          </header>

          <div className="px-2 py-3">
            <Tree
              key={current}
              checkable
              selectable={false}
              blockNode
              defaultExpandAll
              treeData={treeData}
              checkedKeys={checked}
              onCheck={(keys) => {
                const list = Array.isArray(keys) ? keys : keys.checked;
                set(list.map(String).filter((k) => k.includes(".")));
              }}
            />
          </div>

          <footer className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
            <span className="min-w-0 flex-1 text-sm text-muted-foreground">
              {dirty.length ? t("unsaved", { n: dirty.length }) : t("allSaved")}
            </span>
            <Button disabled={!dirty.length || pending} onClick={() => setDraft(saved)}>
              {t("discard")}
            </Button>
            <Button type="primary" loading={pending} disabled={!dirty.length} onClick={save}>
              {t("saveChanges")}
            </Button>
          </footer>
        </section>
      </div>
    </Page>
  );
}
