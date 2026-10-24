"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Checkbox,
  ColorPicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Switch,
  Table,
  type TableProps,
} from "antd";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { createOption, deleteOption, updateOption } from "@/app/(app)/enums/actions";
import { ConfirmAction } from "@/components/common/confirm-action";
import { EnumTag } from "@/components/common/enum-tag";
import { IconPicker } from "@/components/common/icon-picker";
import { Page, PageHeader } from "@/components/layout/page";
import { toast } from "@/lib/toast";
import type { EnumKind, EnumOption } from "@/types/customer";

// Bảng màu preset cho tag = màu Presets (solid) của antd (magenta → purple) + xám.
const TAG_COLORS = [
  "#eb2f96", "#f5222d", "#fa541c", "#fa8c16", "#faad14", "#a0d911",
  "#52c41a", "#13c2c2", "#1677ff", "#2f54eb", "#722ed1", "#8c8c8c",
];

// Trạng thái dialog: đang mở cho kind nào, sửa option nào (null = tạo mới).
type DialogState = { kind: EnumKind; option: EnumOption | null } | null;

// Mỗi trang /enums/[kind] render manager cho đúng 1 kind (page đã query + sort sẵn).
export function EnumsManager({
  kind,
  options,
}: {
  kind: EnumKind;
  options: EnumOption[];
}) {
  const t = useTranslations("enums");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pending, start] = useTransition();

  const remove = async (o: EnumOption) => {
    const res = await deleteOption(o.id, o.kind, o.value);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(t("deleteOk"));
  };

  // Bật/tắt trực tiếp trên bảng (giữ nguyên các trường còn lại).
  const onToggleActive = (o: EnumOption) =>
    start(async () => {
      const res = await updateOption(o.id, {
        label_vi: o.label_vi,
        label_en: o.label_en,
        label_id: o.label_id,
        icon: o.icon,
        color: o.color,
        sort_order: o.sort_order,
        is_active: !o.is_active,
      });
      if (res.error) toast.error(res.error);
    });

  const tag = (o: EnumOption, label: string | null) =>
    label ? (
      <EnumTag icon={o.icon} color={o.color} label={label} />
    ) : (
      <span className="text-muted-foreground">—</span>
    );

  const columns: TableProps<EnumOption>["columns"] = [
    {
      title: t("colValue"),
      dataIndex: "value",
      width: 180,
      render: (v: string) => <span className="font-mono text-xs">{v}</span>,
    },
    { title: t("colVi"), key: "vi", render: (_, o) => tag(o, o.label_vi) },
    { title: t("colEn"), key: "en", render: (_, o) => tag(o, o.label_en) },
    { title: t("colId"), key: "id", render: (_, o) => tag(o, o.label_id) },
    {
      title: t("colActive"),
      dataIndex: "is_active",
      width: 110,
      align: "center",
      render: (_, o) => (
        <Switch
          size="small"
          checked={o.is_active}
          disabled={pending}
          aria-label={t("colActive")}
          title={o.is_active ? t("active") : t("inactive")}
          onChange={() => onToggleActive(o)}
        />
      ),
    },
    {
      title: t("colActions"),
      key: "actions",
      width: 110,
      align: "right",
      render: (_, o) => (
        <div className="flex justify-end gap-1">
          <Button
            type="text"
            size="small"
            title={t("edit")}
            aria-label={t("edit")}
            icon={<Pencil className="size-4" />}
            onClick={() => setDialog({ kind, option: o })}
          />
          <ConfirmAction
            title={t("deleteConfirm")}
            description={t("deleteConfirmBody", { name: o.label_vi })}
            okText={t("delete")}
            cancelText={t("cancel")}
            onConfirm={() => remove(o)}
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
        title={t(`kind_${kind}`)}
        actions={
          <Button
            type="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setDialog({ kind, option: null })}
          >
            {t("add")}
          </Button>
        }
      />

      <Table
        className="surface overflow-hidden"
        rowKey="id"
        columns={columns}
        dataSource={options}
        pagination={false}
        tableLayout="fixed"
        scroll={{ x: 760 }}
        locale={{ emptyText: t("empty") }}
      />

      <OptionDialog state={dialog} onClose={() => setDialog(null)} />
    </Page>
  );
}

type Values = {
  value: string;
  label_vi: string;
  label_en?: string | null; // không bắt buộc — "" = chưa dịch, lưu null
  label_id?: string | null;
  icon?: string | null; // tên icon Lucide; null = không icon
  color?: string | null; // hex #rrggbb; "" = không màu
  sort_order?: number | null;
  is_active: boolean;
};

function OptionDialog({
  state,
  onClose,
}: {
  state: DialogState;
  onClose: () => void;
}) {
  const t = useTranslations("enums");
  const locale = useLocale();
  const [form] = Form.useForm<Values>();
  const [pending, start] = useTransition();
  const editing = state?.option ?? null;

  // Xem trước tag theo giá trị đang nhập (nhãn theo locale hiện tại).
  const w = Form.useWatch([], form) as Partial<Values> | undefined;
  const previewLabel =
    (locale === "en" ? w?.label_en : locale === "id" ? w?.label_id : w?.label_vi) ||
    w?.value ||
    "…";

  const onFinish = (v: Values) =>
    start(async () => {
      if (!state) return;
      const fields = {
        label_vi: v.label_vi.trim(),
        label_en: v.label_en?.trim() || null,
        label_id: v.label_id?.trim() || null,
        icon: v.icon || null,
        color: v.color || null,
        sort_order: v.sort_order ?? 0,
        is_active: v.is_active,
      };
      const res = editing
        ? await updateOption(editing.id, fields)
        : await createOption({ kind: state.kind, value: v.value.trim(), ...fields });
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
          value: editing?.value ?? "",
          label_vi: editing?.label_vi ?? "",
          label_en: editing?.label_en ?? "",
          label_id: editing?.label_id ?? "",
          icon: editing?.icon ?? null,
          color: editing?.color ?? "",
          sort_order: editing?.sort_order ?? 0,
          is_active: editing?.is_active ?? true,
        }}
      >
        <div className="grid grid-cols-2 gap-x-3">
          {/* value cố định sau khi tạo (đổi sẽ mồ côi customers). */}
          <Form.Item
            name="value"
            label={t("colValue")}
            rules={[{ required: true, whitespace: true, message: t("required") }]}
          >
            <Input disabled={!!editing} placeholder="vd: new_lead" autoComplete="off" />
          </Form.Item>
          <Form.Item name="sort_order" label={t("colSort")}>
            <InputNumber className="w-full" />
          </Form.Item>
          <Form.Item
            name="label_vi"
            label={t("colVi")}
            rules={[{ required: true, whitespace: true, message: t("required") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="label_en" label={t("colEn")}>
            <Input placeholder={t("optional")} />
          </Form.Item>
          <Form.Item name="label_id" label={t("colId")}>
            <Input placeholder={t("optional")} />
          </Form.Item>
          <Form.Item name="icon" label={t("iconLabel")}>
            <IconPicker
              placeholder={t("pickIcon")}
              searchPlaceholder={t("searchIcon")}
              clearLabel={t("clearIcon")}
              emptyText={t("noIconResults")}
              countText={(shown, total) => t("iconShown", { shown, total })}
            />
          </Form.Item>
        </div>

        <Form.Item
          name="color"
          label={t("colorLabel")}
          // ColorPicker trả object Color → lưu hex; xoá (allowClear) → "".
          getValueFromEvent={(c) => (c?.cleared ? "" : (c?.toHexString?.() ?? ""))}
          getValueProps={(v) => ({ value: v || undefined })}
        >
          <ColorPicker
            allowClear
            showText
            disabledAlpha
            format="hex"
            presets={[{ label: t("colorLabel"), colors: TAG_COLORS, defaultOpen: true }]}
          />
        </Form.Item>

        {/* Xem trước + kích hoạt */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-dashed border-border p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("preview")}</span>
            <EnumTag icon={w?.icon || null} color={w?.color || null} label={previewLabel} />
          </div>
          <Form.Item name="is_active" valuePropName="checked" noStyle>
            <Checkbox>{t("activeLabel")}</Checkbox>
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
