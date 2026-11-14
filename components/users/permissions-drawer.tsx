"use client";

import { useTransition } from "react";
import { Form, TreeSelect } from "antd";
import { useTranslations } from "next-intl";

import { saveDepartmentPermissions } from "@/app/(app)/users/actions";
import { FormDrawer } from "@/components/common/form-drawer";
import { MODULES, PERMISSION_MODULES } from "@/lib/permissions";
import { toast } from "@/lib/toast";
import { DEPARTMENTS } from "@/types/user";

type Values = Record<string, string[]>;

// Sửa/Xoá mà thiếu Xem thì không vào được trang → tự thêm Xem.
const withView = (keys: string[]) => {
  const out = new Set(keys);
  for (const k of keys) if (!k.endsWith(".view")) out.add(`${k.split(".")[0]}.view`);
  return [...out];
};

/** Drawer phân quyền: mỗi bộ phận 1 TreeSelect (menu → Xem / Sửa / Xoá). Admin luôn toàn quyền. */
export function PermissionsDrawer({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: Values;
}) {
  const t = useTranslations("users");
  const tNav = useTranslations("nav");
  const [form] = Form.useForm<Values>();
  const [pending, start] = useTransition();

  const treeData = MODULES.map((m) => ({
    title: tNav(m),
    value: m,
    children: PERMISSION_MODULES[m].map((a) => ({ title: t(`perm_${a}`), value: `${m}.${a}` })),
  }));

  const onFinish = (values: Values) =>
    start(async () => {
      const res = await saveDepartmentPermissions(values);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("permissionsOk"));
      onClose();
    });

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={t("permissionsTitle")}
      submitText={t("save")}
      pending={pending}
      width={560}
      onSubmit={() => form.submit()}
    >
      <p className="mb-4 text-sm text-muted-foreground">{t("permissionsHint")}</p>
      <Form form={form} layout="vertical" requiredMark={false} initialValues={initial} onFinish={onFinish}>
        {DEPARTMENTS.map((d) => (
          <Form.Item key={d} name={d} label={t(`dept_${d}`)} normalize={(v: string[]) => withView(v ?? [])}>
            <TreeSelect
              treeData={treeData}
              treeCheckable
              showCheckedStrategy={TreeSelect.SHOW_CHILD}
              treeDefaultExpandAll
              maxTagCount="responsive"
              placeholder={t("noPermissions")}
              allowClear
            />
          </Form.Item>
        ))}
      </Form>
    </FormDrawer>
  );
}
