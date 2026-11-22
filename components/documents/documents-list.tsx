"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Input, type TableColumnsType } from "antd";
import dayjs from "dayjs";
import { FileText, Heart, MessageSquare, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { StatusDot } from "@/components/common/cells";
import { ClearableSelect } from "@/components/common/clearable-select";
import { useConfirm } from "@/components/common/confirm-action";
import { DataTable } from "@/components/common/data-table";
import { RowActions } from "@/components/common/row-actions";
import { UserAvatar } from "@/components/common/user-avatar";
import { Page, PageHeader, PageToolbar } from "@/components/layout/page";
import { deleteDocument } from "@/app/(app)/documents/actions";
import { DOCUMENT_CATEGORIES, categoryColor } from "@/lib/document-categories";
import { toast } from "@/lib/toast";
import type { DocumentListItem } from "@/types/document";

/** Bỏ dấu để tìm "quy trinh" ra "Quy trình". */
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").toLowerCase();

export function DocumentsList({ documents, isAdmin }: { documents: DocumentListItem[]; isAdmin: boolean }) {
  const t = useTranslations("documents");
  const tu = useTranslations("users");
  const tn = useTranslations("nav");
  const router = useRouter();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  const needle = fold(q.trim());
  const shown = documents.filter(
    (d) => (!category || d.category === category) && (!needle || fold(d.title).includes(needle)),
  );

  const remove = (d: DocumentListItem) =>
    confirm({
      title: t("deleteConfirm"),
      content: d.title,
      okText: t("delete"),
      cancelText: t("cancel"),
      onOk: async () => {
        const res = await deleteDocument(d.id);
        if (res.error !== undefined) toast.error(res.error);
        else toast.success(t("deleted"));
      },
    });

  const columns: TableColumnsType<DocumentListItem> = [
    {
      key: "title",
      title: t("colTitle"),
      render: (_, d) => (
        <span className="flex min-w-60 items-center gap-2">
          <Link href={`/documents/${d.id}`} className="line-clamp-2 font-medium">
            {d.title}
          </Link>
          {d.pdf_path ? (
            <FileText className="size-4 shrink-0 text-muted-foreground" role="img" aria-label="PDF">
              <title>PDF</title>
            </FileText>
          ) : null}
        </span>
      ),
    },
    {
      key: "category",
      title: t("category"),
      render: (_, d) => <StatusDot color={categoryColor(d.category)} label={t(`cat_${d.category}`)} />,
    },
    {
      key: "departments",
      title: t("colDepartments"),
      hidden: !isAdmin,
      render: (_, d) => (
        <span className="text-muted-foreground">
          {d.departments.length ? d.departments.map((dep) => tu(`dept_${dep}`)).join(", ") : t("allDepartments")}
        </span>
      ),
    },
    {
      key: "author",
      title: t("colAuthor"),
      render: (_, d) => (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <UserAvatar src={d.author?.avatar_url} size={22} />
          {d.author?.user_name ?? "—"}
        </span>
      ),
    },
    {
      key: "created_at",
      title: t("colCreated"),
      sorter: (a, b) => a.created_at.localeCompare(b.created_at),
      render: (_, d) => <span className="whitespace-nowrap tabular-nums">{dayjs(d.created_at).format("DD/MM/YYYY")}</span>,
    },
    {
      key: "engagement",
      title: t("colEngagement"),
      render: (_, d) => (
        <span className="flex items-center gap-3 text-muted-foreground tabular-nums">
          <span className="flex items-center gap-1" title={t("likes")}>
            <Heart className="size-3.5" />
            {d.likes[0]?.count ?? 0}
          </span>
          <span className="flex items-center gap-1" title={t("comments")}>
            <MessageSquare className="size-3.5" />
            {d.comments[0]?.count ?? 0}
          </span>
        </span>
      ),
    },
    {
      key: "actions",
      width: 48,
      hidden: !isAdmin,
      render: (_, d) => (
        <RowActions
          label={t("actions")}
          items={[
            { icon: <Pencil className="size-4" />, label: t("edit"), onSelect: () => router.push(`/documents/${d.id}/edit`) },
            { icon: <Trash2 className="size-4" />, label: t("delete"), danger: true, onSelect: () => remove(d) },
          ]}
        />
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title={tn("documents")}
        actions={
          isAdmin ? (
            <Link href="/documents/new">
              <Button type="primary" icon={<Plus className="size-4" />} className="w-full">
                {t("new")}
              </Button>
            </Link>
          ) : null
        }
      />
      <PageToolbar>
        <Input

          allowClear
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder={t("search")}
          aria-label={t("search")}
          prefix={<Search className="size-4 text-muted-foreground" />}
          className="sm:max-w-80"
        />
        <ClearableSelect
          value={category}
          onChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
          placeholder={t("allCategories")}
          ariaLabel={t("category")}
          options={DOCUMENT_CATEGORIES.map((c) => ({ value: c.value, label: t(`cat_${c.value}`) }))}
          className="sm:w-48"
        />
      </PageToolbar>

      <DataTable<DocumentListItem>
        columns={columns}
        dataSource={shown}
        page={page}
        onPageChange={setPage}
        empty={q || category ? t("noMatch") : t("empty")}
      />
    </Page>
  );
}
