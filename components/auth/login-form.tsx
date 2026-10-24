"use client";

import { useEffect, useTransition } from "react";
import { Button, Checkbox, Form, Input } from "antd";
import { useTranslations } from "next-intl";

import { signIn } from "@/lib/actions/auth";
import { toast } from "@/lib/toast";

type Values = { email: string; password: string; remember: boolean };

// ponytail: "ghi nhớ đăng nhập" = lưu email+mật khẩu plaintext trong
// localStorage để prefill — máy dùng chung thì bỏ tick lúc đăng nhập.
const CREDS_KEY = "lavian-login";

function savedCreds(): { email: string; password: string } | null {
  try {
    return JSON.parse(localStorage.getItem(CREDS_KEY) ?? "null");
  } catch {
    return null; // JSON hỏng
  }
}

export function LoginForm() {
  const t = useTranslations("auth");
  const [form] = Form.useForm<Values>();
  const [pending, start] = useTransition();

  // Prefill sau mount (localStorage không có ở SSR) → không lệch hydration.
  useEffect(() => {
    const creds = savedCreds();
    if (creds) form.setFieldsValue(creds);
  }, [form]);

  const onFinish = (values: Values) =>
    start(async () => {
      // Lưu TRƯỚC khi gọi signIn — thành công sẽ redirect ngay.
      if (values.remember)
        localStorage.setItem(
          CREDS_KEY,
          JSON.stringify({ email: values.email, password: values.password }),
        );
      else localStorage.removeItem(CREDS_KEY);
      const res = await signIn({ email: values.email, password: values.password });
      if (res?.error) toast.error(res.error);
    });

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      initialValues={{ remember: true }}
      onFinish={onFinish}
    >
      <Form.Item
        name="email"
        label={t("email")}
        rules={[{ required: true, type: "email", message: t("emailInvalid") }]}
      >
        <Input type="email" autoComplete="email" autoFocus size="large" />
      </Form.Item>
      <Form.Item
        name="password"
        label={t("password")}
        rules={[{ required: true, message: t("passwordRequired") }]}
      >
        <Input.Password autoComplete="current-password" size="large" />
      </Form.Item>
      <Form.Item name="remember" valuePropName="checked">
        <Checkbox>{t("rememberMe")}</Checkbox>
      </Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={pending}>
        {t("signIn")}
      </Button>
    </Form>
  );
}
