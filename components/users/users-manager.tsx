"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Checkbox, Form, Input, Modal, Table, Tag, type TableProps } from "antd";
import { useTranslations } from "next-intl";
import { Ban, KeyRound, Search, ShieldCheck, UserPlus } from "lucide-react";

import {
  createUser,
  resetPassword,
  setUserDepartment,
  setUserStatus,
} from "@/app/(app)/users/actions";
import { ClearableSelect } from "@/components/common/clearable-select";
import { ConfirmAction } from "@/components/common/confirm-action";
import { ImageUpload } from "@/components/common/image-upload";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { toast } from "@/lib/toast";
import type { Profile, UserDepartment } from "@/types/user";

const DEPARTMENTS: UserDepartment[] = ["customer_care", "technician", "sales"];

export function UsersManager({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const t = useTranslations("users");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.user_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q),
    );
  }, [profiles, query]);

  const departmentOptions = DEPARTMENTS.map((d) => ({
    value: d,
    label: t(`dept_${d}`),
  }));

  const changeDepartment = (p: Profile, value: string) =>
    start(async () => {
      const res = await setUserDepartment(
        p.id,
        (value || null) as UserDepartment | null,
      );
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("departmentOk"));
    });

  const toggleBan = async (p: Profile) => {
    const next = p.status === "banned" ? "active" : "banned";
    const res = await setUserStatus(p.id, next);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(next === "banned" ? t("bannedOk") : t("unbannedOk"));
  };

  const columns: TableProps<Profile>["columns"] = [
    {
      title: t("colName"),
      dataIndex: "user_name",
      render: (v: string) => <span className="font-medium">{v || "—"}</span>,
    },
    { title: t("colEmail"), dataIndex: "email" },
    {
      title: t("colRole"),
      dataIndex: "role",
      render: (role: Profile["role"]) => (
        <Tag color={role === "admin" ? "purple" : undefined} variant={role === "admin" ? "solid" : undefined}>{t(`role_${role}`)}</Tag>
      ),
    },
    {
      title: t("colDepartment"),
      dataIndex: "department",
      render: (_, p) => (
        <ClearableSelect
          value={p.department}
          onChange={(v) => changeDepartment(p, v)}
          options={departmentOptions}
          placeholder="—"
          ariaLabel={t("colDepartment")}
          className="w-full min-w-40"
        />
      ),
    },
    {
      title: t("colStatus"),
      dataIndex: "status",
      render: (status: Profile["status"]) => (
        <Tag color={status === "banned" ? "error" : "default"} variant={status === "banned" ? "solid" : undefined}>
          {t(`status_${status}`)}
        </Tag>
      ),
    },
    {
      title: t("colCreated"),
      dataIndex: "created_at",
      render: (v: string) => (
        <span className="text-muted-foreground">{new Date(v).toLocaleDateString()}</span>
      ),
    },
    {
      title: t("colActions"),
      key: "actions",
      align: "right",
      render: (_, p) => {
        const banned = p.status === "banned";
        return (
          <div className="flex justify-end gap-1">
            <Button
              type="text"
              size="small"
              title={t("resetPassword")}
              aria-label={t("resetPassword")}
              icon={<KeyRound className="size-4" />}
              onClick={() => setResetTarget(p)}
            />
            <ConfirmAction
              title={banned ? t("unban") : t("ban")}
              description={p.email}
              danger={!banned}
              disabled={p.id === currentUserId}
              onConfirm={() => toggleBan(p)}
            >
              <Button
                type="text"
                size="small"
                danger={!banned}
                title={banned ? t("unban") : t("ban")}
                aria-label={banned ? t("unban") : t("ban")}
                disabled={p.id === currentUserId}
                icon={
                  banned ? (
                    <ShieldCheck className="size-4 text-success" />
                  ) : (
                    <Ban className="size-4" />
                  )
                }
              />
            </ConfirmAction>
          </div>
        );
      },
    },
  ];

  return (
    <Page>
      <PageHeader
        title={t("title")}
        actions={
          <Button
            type="primary"
            icon={<UserPlus className="size-4" />}
            onClick={() => setCreateOpen(true)}
          >
            {t("create")}
          </Button>
        }
      />

      <PageToolbar>
        <Input
          allowClear
          className="w-full sm:max-w-56"
          prefix={<Search className="size-4 text-muted-foreground" />}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </PageToolbar>

      <Table
        className="surface overflow-hidden"
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        loading={pending}
        pagination={false}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: t("empty") }}
      />

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ResetPasswordDialog
        target={resetTarget}
        onClose={() => setResetTarget(null)}
      />
    </Page>
  );
}

type CreateValues = {
  email: string;
  password: string;
  user_name: string;
  avatar_url?: string | null;
  department?: string;
  isAdmin?: boolean;
};

function CreateUserDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("users");
  const [form] = Form.useForm<CreateValues>();
  const [pending, start] = useTransition();

  const onFinish = (v: CreateValues) =>
    start(async () => {
      const res = await createUser({
        email: v.email,
        password: v.password,
        user_name: v.user_name,
        avatar_url: v.avatar_url || undefined,
        role: v.isAdmin ? "admin" : "user",
        department: (v.department || null) as UserDepartment | null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("createOk"));
      form.resetFields();
      onClose();
    });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t("createTitle")}
      okText={t("createSubmit")}
      cancelText={t("cancel")}
      confirmLoading={pending}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <p className="mb-4 text-sm text-muted-foreground">{t("createDesc")}</p>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={onFinish}>
        <Form.Item
          name="email"
          label={t("colEmail")}
          rules={[{ required: true, type: "email", message: t("emailInvalid") }]}
        >
          <Input type="email" autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="password"
          label={t("newPassword")}
          rules={[{ required: true, min: 6, message: t("passwordMin") }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="user_name"
          label={t("colName")}
          rules={[{ required: true, whitespace: true, message: t("nameRequired") }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="department" label={t("colDepartment")}>
          <ClearableSelect
            options={DEPARTMENTS.map((d) => ({ value: d, label: t(`dept_${d}`) }))}
            placeholder="—"
            ariaLabel={t("colDepartment")}
          />
        </Form.Item>
        <Form.Item name="avatar_url" label={t("avatarUrl")}>
          <ImageUpload className="rounded-full" />
        </Form.Item>
        <Form.Item name="isAdmin" valuePropName="checked" className="mb-0">
          <Checkbox>{t("makeAdmin")}</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
}

function ResetPasswordDialog({
  target,
  onClose,
}: {
  target: Profile | null;
  onClose: () => void;
}) {
  const t = useTranslations("users");
  const [form] = Form.useForm<{ password: string }>();
  const [pending, start] = useTransition();

  const onFinish = ({ password }: { password: string }) =>
    start(async () => {
      if (!target) return;
      const res = await resetPassword(target.id, password);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("resetOk"));
      onClose();
    });

  return (
    <Modal
      open={!!target}
      onCancel={onClose}
      title={t("resetTitle")}
      okText={t("resetSubmit")}
      cancelText={t("cancel")}
      confirmLoading={pending}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <p className="mb-4 text-sm text-muted-foreground">{target?.email}</p>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={onFinish}>
        <Form.Item
          name="password"
          label={t("newPassword")}
          rules={[{ required: true, min: 6, message: t("passwordMin") }]}
          className="mb-0"
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
