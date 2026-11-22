"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  type TableProps,
} from "antd";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  createService,
  deleteService,
  updateService,
} from "@/app/(app)/services/actions";
import { useConfirm } from "@/components/common/confirm-action";
import { useCan } from "@/components/common/permissions";
import { DataTable } from "@/components/common/data-table";
import { FormDrawer } from "@/components/common/form-drawer";
import { MoneyInput } from "@/components/common/money-input";
import { RowActions } from "@/components/common/row-actions";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { toast } from "@/lib/toast";
import { useServiceGroups } from "@/components/common/service-groups";
import { formatRupiah } from "@/lib/currency";
import type { Service, ServiceInput } from "@/types/service";

// Trạng thái dialog: null = đóng; service null = tạo mới.
type DialogState = { service: Service | null } | null;

export function ServicesManager({ services }: { services: Service[] }) {
  const t = useTranslations("services");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [, start] = useTransition();
  const confirm = useConfirm();
  const groups = useServiceGroups();
  const can = useCan();
  const canEdit = can("services.edit");
  const canDelete = can("services.delete");
  // Bật/tắt hiện ngay; server trả về thì React tự đồng bộ (lỗi → quay lại).
  // Xếp theo thứ tự nhóm rồi thứ tự dịch vụ (giống bảng giá).
  const sorted = useMemo(() => {
    const order = new Map(groups.groups.map((g, i) => [g.id, i]));
    return [...services].sort((a, b) =>
      (order.get(a.group_id) ?? 999) - (order.get(b.group_id) ?? 999) || a.sort_order - b.sort_order);
  }, [services, groups.groups]);
  const [rows, patchRow] = useOptimistic(
    sorted,
    (state: Service[], p: { id: string; is_active: boolean }) =>
      state.map((r) => (r.id === p.id ? { ...r, is_active: p.is_active } : r)),
  );


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
      patchRow({ id: s.id, is_active: !s.is_active });
      const res = await updateService(s.id, {
        group_id: s.group_id,
        name: s.name,
        price: s.price,
        sort_order: s.sort_order,
        is_active: !s.is_active,
        tourable: s.tourable,
      });
      if (res.error) toast.error(res.error);
    });

  const groupSize = new Map<string, number>();
  for (const r of rows) groupSize.set(r.group_id, (groupSize.get(r.group_id) ?? 0) + 1);

  const columns: TableProps<Service>["columns"] = [
    {
      title: t("colCategory"),
      dataIndex: "group_id",
      width: 180,
      // Gộp ô nhóm theo chiều dọc như bảng giá (rows đã xếp theo nhóm, không phân trang).
      onCell: (s, i = 0) => ({
        rowSpan: i > 0 && rows[i - 1].group_id === s.group_id ? 0 : groupSize.get(s.group_id),
      }),
      render: (g: string) => <span className="font-medium">{groups.name(g)}</span>,
    },
    { title: t("colName"), dataIndex: "name", ellipsis: true },
    {
      title: t("colPrice"),
      dataIndex: "price",
      width: 160,
      align: "right",
      render: (v: number) => <span className="tabular-nums">{formatRupiah(v)}</span>,
    },
    {
      title: t("colActive"),
      dataIndex: "is_active",
      width: 110,
      align: "center",
      render: (_, s) => (
        <Switch
          size="small"
          checked={s.is_active}
          aria-label={t("colActive")}
          title={s.is_active ? t("active") : t("inactive")}
          disabled={!canEdit}
          onChange={() => onToggleActive(s)}
        />
      ),
    },
    {
      title: t("colActions"),
      key: "actions",
      width: 72,
      align: "right",
      render: (_, s) =>
        canEdit || canDelete ? (
          <RowActions
            label={t("colActions")}
            items={[
              ...(canEdit ? [{ icon: <Pencil className="size-4" />, label: t("edit"), onSelect: () => setDialog({ service: s }) }] : []),
              ...(canDelete
                ? [{
                    icon: <Trash2 className="size-4" />,
                    label: t("delete"),
                    danger: true,
                    onSelect: () =>
                      confirm({
                        title: t("deleteConfirm"),
                        content: t("deleteConfirmBody", { name: s.name }),
                        okText: t("delete"),
                        cancelText: t("cancel"),
                        onOk: () => remove(s),
                      }),
                  }]
                : []),
            ]}
          />
        ) : null,
    },
  ];

  return (
    <Page>
      <PageHeader title={t("title")} />

      {/* Không có bộ lọc — vẫn đặt nút thêm ở hàng toolbar cho đồng bộ các trang. */}
      {canEdit && (
        <PageToolbar>
          <Button type="primary" icon={<Plus className="size-4" />} onClick={() => setDialog({ service: null })}>
            {t("add")}
          </Button>
        </PageToolbar>
      )}

      <DataTable
        columns={columns}
        dataSource={rows}
        pageSize={0}
        tableLayout="fixed"
        empty={t("empty")}
      />

      <ServiceDialog state={dialog} onClose={() => setDialog(null)} />
    </Page>
  );
}

type Values = {
  group_id: string;
  name: string;
  price?: number | null;
  sort_order?: number | null;
  is_active: boolean;
  tourable: boolean;
};

function ServiceDialog({
  state,
  onClose,
}: {
  state: DialogState;
  onClose: () => void;
}) {
  const t = useTranslations("services");
  const groups = useServiceGroups();
  const [form] = Form.useForm<Values>();
  const [pending, start] = useTransition();
  const editing = state?.service ?? null;

  const onFinish = (v: Values) =>
    start(async () => {
      const input: ServiceInput = {
        group_id: v.group_id,
        name: v.name.trim(),
        price: v.price ?? 0,
        sort_order: v.sort_order ?? 0,
        is_active: v.is_active,
        tourable: v.tourable,
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
    <FormDrawer
      open={!!state}
      onClose={onClose}
      title={editing ? t("editTitle") : t("addTitle")}
      pending={pending}
      onSubmit={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={onFinish}
        initialValues={{
          group_id: editing?.group_id,
          name: editing?.name ?? "",
          price: editing?.price ?? 0,
          sort_order: editing?.sort_order ?? 0,
          is_active: editing?.is_active ?? true,
          tourable: editing?.tourable ?? true,
        }}
      >
        <div className="grid grid-cols-2 gap-x-3">
          <Form.Item
            name="group_id"
            label={t("colCategory")}
            rules={[{ required: true, message: t("required") }]}
          >
            <Select options={groups.allOptions} />
          </Form.Item>
          <Form.Item
            name="price"
            label={t("colPrice")}
            rules={[{ required: true, message: t("required") }]}
          >
            <MoneyInput ariaLabel={t("colPrice")} />
          </Form.Item>
          <Form.Item
            name="name"
            label={t("colName")}
            className="col-span-2"
            rules={[{ required: true, whitespace: true, message: t("required") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="sort_order" label={t("colSort")}>
            <InputNumber className="w-full" />
          </Form.Item>
        </div>
        <Form.Item name="is_active" valuePropName="checked" className="mb-2">
          <Checkbox>{t("activeLabel")}</Checkbox>
        </Form.Item>
        <Form.Item name="tourable" valuePropName="checked" className="mb-0">
          <Checkbox>{t("tourableLabel")}</Checkbox>
        </Form.Item>
      </Form>
    </FormDrawer>
  );
}
