"use client";

import { useTransition } from "react";
import { Form, Input, Modal } from "antd";
import { useTranslations } from "next-intl";

import { ImageUpload } from "@/components/common/image-upload";
import { updateMyProfile } from "@/lib/actions/auth";
import { toast } from "@/lib/toast";

type Values = { user_name: string; avatar_url?: string | null };

/** User tự đổi tên hiển thị + avatar (mở từ menu tài khoản). */
export function ProfileDialog({
  open,
  onClose,
  userName,
  avatarUrl,
}: {
  open: boolean;
  onClose: () => void;
  userName?: string;
  avatarUrl?: string | null;
}) {
  const t = useTranslations("auth");
  const [form] = Form.useForm<Values>();
  const [pending, start] = useTransition();

  const onFinish = (v: Values) =>
    start(async () => {
      const res = await updateMyProfile({
        user_name: v.user_name,
        avatar_url: v.avatar_url || null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("profileSaved"));
      onClose();
    });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t("myProfile")}
      okText={t("save")}
      cancelText={t("cancel")}
      confirmLoading={pending}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={onFinish}
        initialValues={{ user_name: userName ?? "", avatar_url: avatarUrl ?? null }}
      >
        <Form.Item name="avatar_url" label={t("avatar")}>
          <ImageUpload className="rounded-full" />
        </Form.Item>
        <Form.Item
          name="user_name"
          label={t("displayName")}
          rules={[{ required: true, whitespace: true, message: t("nameRequired") }]}
          className="mb-0"
        >
          <Input maxLength={80} autoComplete="off" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
