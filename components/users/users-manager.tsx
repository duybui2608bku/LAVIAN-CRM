"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { Avatar, Button, Form, Input, Modal, Tag, Tooltip, Upload, type TableProps } from "antd";
import { useTranslations } from "next-intl";
import { Ban, Camera, KeyRound, Loader2, Search, ShieldCheck, User, UserPlus } from "lucide-react";

import {
  createUser,
  resetPassword,
  setUserAvatar,
  setUserDepartment,
  setUserStatus,
} from "@/app/(app)/users/actions";
import { ClearableSelect } from "@/components/common/clearable-select";
import { useConfirm } from "@/components/common/confirm-action";
import { DataTable } from "@/components/common/data-table";
import { FormDrawer } from "@/components/common/form-drawer";
import { InlineSelect } from "@/components/common/inline-select";
import { RowActions } from "@/components/common/row-actions";
import { ImageUpload, uploadImage } from "@/components/common/image-upload";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { normalizeError } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { DEPARTMENTS, type Profile, type UserDepartment } from "@/types/user";

const NO_DEPT = "none"; // giá trị lọc "Chưa gán bộ phận"

export function UsersManager({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const t = useTranslations("users");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState(""); // "" = tất cả
  const [department, setDepartment] = useState(""); // "" = tất cả, NO_DEPT = chưa gán
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [, start] = useTransition();
  const confirm = useConfirm();
  // Đổi phòng ban/avatar hiện ngay; server trả về thì React tự đồng bộ (lỗi → quay lại).
  const [rows, patchRow] = useOptimistic(
    profiles,
    (state: Profile[], p: Pick<Profile, "id"> & Partial<Profile>) =>
      state.map((r) => (r.id === p.id ? { ...r, ...p } : r)),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (p) =>
        (!q ||
          p.user_name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)) &&
        (!role || p.role === role) &&
        (!department || (p.department ?? NO_DEPT) === department),
    );
  }, [rows, query, role, department]);

  const departmentOptions = DEPARTMENTS.map((d) => ({
    value: d,
    label: t(`dept_${d}`),
  }));

  const changeDepartment = (p: Profile, value: string) =>
    start(async () => {
      patchRow({ id: p.id, department: (value || null) as UserDepartment | null });
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

  const changeAvatar = (p: Profile, avatar_url: string) =>
    start(async () => {
      patchRow({ id: p.id, avatar_url });
      const res = await setUserAvatar(p.id, avatar_url);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("avatarOk"));
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
      render: (v: string, p) => (
        <span className="flex items-center gap-2">
          <EditableAvatar
            src={p.avatar_url}
            hint={t("changeAvatar")}
            onUploaded={(url) => changeAvatar(p, url)}
          />
          <span className="truncate font-medium">{v || "—"}</span>
        </span>
      ),
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
        <InlineSelect
          value={p.department ?? ""}
          display={
            p.department ? t(`dept_${p.department}`) : <span className="text-muted-foreground">—</span>
          }
          options={departmentOptions}
          noneLabel="—"
          ariaLabel={t("colDepartment")}
          onSave={(v) => changeDepartment(p, v)}
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
      width: 72,
      render: (_, p) => {
        const banned = p.status === "banned";
        return (
          <RowActions
            label={t("colActions")}
            items={[
              {
                icon: <KeyRound className="size-4" />,
                label: t("resetPassword"),
                onSelect: () => setResetTarget(p),
              },
              {
                icon: banned ? <ShieldCheck className="size-4" /> : <Ban className="size-4" />,
                label: banned ? t("unban") : t("ban"),
                danger: !banned,
                disabled: p.id === currentUserId,
                onSelect: () =>
                  confirm({
                    title: banned ? t("unban") : t("ban"),
                    content: p.email,
                    okText: banned ? t("unban") : t("ban"),
                    cancelText: t("cancel"),
                    onOk: () => toggleBan(p),
                  }),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <Page>
      <PageHeader title={t("title")} />

      <PageToolbar>
        <Input
          allowClear
          className="w-full sm:max-w-56"
          prefix={<Search className="size-4 text-muted-foreground" />}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ClearableSelect
          className="min-w-32"
          value={role}
          onChange={setRole}
          options={(["admin", "user"] as const).map((r) => ({ value: r, label: t(`role_${r}`) }))}
          placeholder={t("allRole")}
          ariaLabel={t("colRole")}
        />
        <ClearableSelect
          className="min-w-44"
          value={department}
          onChange={setDepartment}
          options={[...departmentOptions, { value: NO_DEPT, label: t("noDepartment") }]}
          placeholder={t("allDepartment")}
          ariaLabel={t("colDepartment")}
        />
        <Button
          type="primary"
          icon={<UserPlus className="size-4" />}
          onClick={() => setCreateOpen(true)}
        >
          {t("create")}
        </Button>
      </PageToolbar>

      <DataTable columns={columns} dataSource={filtered} pageSize={0} empty={t("empty")} />

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ResetPasswordDialog
        target={resetTarget}
        onClose={() => setResetTarget(null)}
      />
    </Page>
  );
}

/** Avatar bấm được: chọn ảnh → upload → onUploaded(url). */
function EditableAvatar({
  src,
  hint,
  onUploaded,
}: {
  src: string | null;
  hint: string;
  onUploaded: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Vui lòng chọn tệp ảnh.");
    if (file.size > 10 * 1024 * 1024) return toast.error("Ảnh vượt quá 10MB.");
    setBusy(true);
    try {
      onUploaded(await uploadImage(file));
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Tooltip title={hint}>
      <Upload
        accept="image/*"
        showUploadList={false}
        disabled={busy}
        beforeUpload={(file) => {
          void onFile(file);
          return false; // tự upload, không để antd POST
        }}
      >
        <span aria-label={hint} className="group relative flex shrink-0 cursor-pointer rounded-full">
          {/* Không có ảnh → icon người thay vì ảnh mặc định. */}
          <Avatar size={28} src={src || undefined} icon={<User className="size-4" />} alt="" />
          <span
            className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white transition-opacity ${
              busy ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
          </span>
        </span>
      </Upload>
    </Tooltip>
  );
}

type CreateValues = {
  email: string;
  password: string;
  user_name: string;
  avatar_url?: string | null;
  department?: string;
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
        role: "user",
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
    <FormDrawer
      open={open}
      onClose={onClose}
      title={t("createTitle")}
      submitText={t("createSubmit")}
      pending={pending}
      onSubmit={() => form.submit()}
    >
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
        <Form.Item
          name="avatar_url"
          label={t("avatarUrl")}
          className="mb-0"
        >
          <ImageUpload className="rounded-full" />
        </Form.Item>
      </Form>
    </FormDrawer>
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
