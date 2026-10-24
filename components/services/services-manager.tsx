"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Switch,
  Table,
  type TableProps,
} from "antd";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  createService,
  deleteService,
  updateService,
} from "@/app/(app)/services/actions";
import { ConfirmAction } from "@/components/common/confirm-action";
import { Page, PageHeader } from "@/components/layout/page";
import { toast } from "@/lib/toast";
import type { Service, ServiceInput } from "@/types/service";

// Trạng thái dialog: null = đóng; service null = tạo mới.
type DialogState = { service: Service | null } | null;

const dash = (v: string | null) =>
  v || <span className="text-muted-foreground">—</span>;

export function ServicesManager({ services }: { services: Service[] }) {
  const t = useTranslations("services");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pending, start] = useTransition();

  const remove = async (s: Service) => {
    const res = await deleteService(s.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(t("deleteOk"));
  };

  // Bật/tắt trực tiếp trên bảng (giữ nguyên các trường còn lại).
  const onToggleActive = (s: Service) =>
    start(async () => {
      const res = await updateService(s.id, {
        name_vi: s.name_vi,
        name_en: s.name_en,
        name_id: s.name_id,
        sort_order: s.sort_order,
        is_active: !s.is_active,
      });
      if (res.error) toast.error(res.error);
    });

  const columns: TableProps<Service>["columns"] = [
    { title: t("colVi"), dataIndex: "name_vi", ellipsis: true },
    { title: t("colEn"), dataIndex: "name_en", ellipsis: true, render: dash },
    { title: t("colId"), dataIndex: "name_id", ellipsis: true, render: dash },
    {
      title: t("colActive"),
      dataIndex: "is_active",
      width: 110,
      align: "center",
      render: (_, s) => (
        <Switch
          size="small"
          checked={s.is_active}
          disabled={pending}
          aria-label={t("colActive")}
          title={s.is_active ? t("active") : t("inactive")}
          onChange={() => onToggleActive(s)}
        />
      ),
    },
    {
      title: t("colActions"),
      key: "actions",
      width: 110,
      align: "right",
      render: (_, s) => (
        <div className="flex justify-end gap-1">
          <Button
            type="text"
            size="small"
            title={t("edit")}
            aria-label={t("edit")}
            icon={<Pencil className="size-4" />}
            onClick={() => setDialog({ service: s })}
          />
          <ConfirmAction
            title={t("deleteConfirm")}
            description={t("deleteConfirmBody", { name: s.name_vi })}
            okText={t("delete")}
            cancelText={t("cancel")}
            onConfirm={() => remove(s)}
          >
            <Button
              type="text"
              size="small"
              danger
              title={t("delete")}
              aria-label={t("delete")}
              icon={<Trash2 className="size-4" />}
            />
          </ConfirmAction>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title={t("title")}
        actions={
          <Button
            type="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setDialog({ service: null })}
          >
            {t("add")}
          </Button>
        }
      />

      <Table
        className="surface overflow-hidden"
        rowKey="id"
        columns={columns}
        dataSource={services}
        pagination={false}
        tableLayout="fixed"
        locale={{ emptyText: t("empty") }}
      />

      <ServiceDialog state={dialog} onClose={() => setDialog(null)} />
    </Page>
  );
}

type Values = {
  name_vi: string;
  name_en?: string | null;
  name_id?: string | null;
  sort_order?: number | null;
  is_active: boolean;
};

function ServiceDialog({
  state,
  onClose,
}: {
  state: DialogState;
  onClose: () => void;
}) {
  const t = useTranslations("services");
  const [form] = Form.useForm<Values>();
  const [pending, start] = useTransition();
  const editing = state?.service ?? null;

  const onFinish = (v: Values) =>
    start(async () => {
      const input: ServiceInput = {
        name_vi: v.name_vi.trim(),
        // không bắt buộc — "" = chưa dịch, lưu null
        name_en: v.name_en?.trim() || null,
        name_id: v.name_id?.trim() || null,
        sort_order: v.sort_order ?? 0,
        is_active: v.is_active,
      };
      const res = editing
        ? await updateService(editing.id, input)
        : await createService(input);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? t("updateOk") : t("createOk"));
      onClose();
    });

  return (
    <Modal
      open={!!state}
      onCancel={onClose}
      title={editing ? t("editTitle") : t("addTitle")}
      okText={t("save")}
      cancelText={t("cancel")}
      confirmLoading={pending}
      onOk={() => form.submit()}
      destroyOnHidden
      width={560}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={onFinish}
        initialValues={{
          name_vi: editing?.name_vi ?? "",
          name_en: editing?.name_en ?? "",
          name_id: editing?.name_id ?? "",
          sort_order: editing?.sort_order ?? 0,
          is_active: editing?.is_active ?? true,
        }}
      >
        <div className="grid grid-cols-2 gap-x-3">
          <Form.Item
            name="name_vi"
            label={t("colVi")}
            rules={[{ required: true, whitespace: true, message: t("required") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="name_en" label={t("colEn")}>
            <Input placeholder={t("optional")} />
          </Form.Item>
          <Form.Item name="name_id" label={t("colId")}>
            <Input placeholder={t("optional")} />
          </Form.Item>
          <Form.Item name="sort_order" label={t("colSort")}>
            <InputNumber className="w-full" />
          </Form.Item>
        </div>
        <Form.Item name="is_active" valuePropName="checked" className="mb-0">
          <Checkbox>{t("activeLabel")}</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
}
