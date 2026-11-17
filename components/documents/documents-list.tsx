"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Empty, Input, Tag } from "antd";
import dayjs from "dayjs";
import { FileText, Heart, MessageSquare, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { useConfirm } from "@/components/common/confirm-action";
import { RowActions } from "@/components/common/row-actions";
import { UserAvatar } from "@/components/common/user-avatar";
import { Page, PageToolbar } from "@/components/layout/page";
import { deleteDocument } from "@/app/(app)/documents/actions";
import { toast } from "@/lib/toast";
import type { DocumentListItem } from "@/types/document";

/** Bỏ dấu để tìm "quy trinh" ra "Quy trình". */
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").toLowerCase();

export function DocumentsList({ documents, isAdmin }: { documents: DocumentListItem[]; isAdmin: boolean }) {
  const t = useTranslations("documents");
  const tu = useTranslations("users");
  const router = useRouter();
  const confirm = useConfirm();
  const [q, setQ] = useState("");

  const shown = q.trim() ? documents.filter((d) => fold(d.title).includes(fold(q.trim()))) : documents;

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

  return (
    <Page>
      {/* Không tiêu đề trang — menu đã nói đây là "Tài liệu"; chỉ ô tìm + nút thêm. */}
      <PageToolbar>
        <Input
          allowClear
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          prefix={<Search className="size-4 text-muted-foreground" />}
          className="sm:max-w-80"
        />
        {isAdmin ? (
          <Link href="/documents/new" className="sm:ms-auto">
            <Button type="primary" icon={<Plus className="size-4" />} className="w-full">
              {t("new")}
            </Button>
          </Link>
        ) : null}
      </PageToolbar>

      {shown.length === 0 ? (
        <div className="surface py-12">
          <Empty description={q ? t("noMatch") : t("empty")} />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((d) => (
            <li
              key={d.id}
              className="surface relative flex flex-col gap-3 p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                  <FileText className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  {/* Link phủ cả thẻ (after:inset-0); menu admin nằm trên (z-10) nên bấm được riêng. */}
                  <Link
                    href={`/documents/${d.id}`}
                    className="line-clamp-2 font-medium text-foreground! after:absolute after:inset-0 after:rounded-xl"
                  >
                    {d.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {d.pdf_path ? <Tag color="red" variant="filled" className="m-0!">PDF</Tag> : null}
                    {isAdmin &&
                      (d.departments.length ? (
                        d.departments.map((dep) => (
                          <Tag key={dep} variant="filled" className="m-0!">
                            {tu(`dept_${dep}`)}
                          </Tag>
                        ))
                      ) : (
                        <Tag variant="filled" className="m-0!">
                          {t("allDepartments")}
                        </Tag>
                      ))}
                  </div>
                </div>
                {isAdmin ? (
                  <div className="relative z-10 -me-1 -mt-1">
                    <RowActions
                      label={t("actions")}
                      items={[
                        {
                          icon: <Pencil className="size-4" />,
                          label: t("edit"),
                          onSelect: () => router.push(`/documents/${d.id}/edit`),
                        },
                        { icon: <Trash2 className="size-4" />, label: t("delete"), danger: true, onSelect: () => remove(d) },
                      ]}
                    />
                  </div>
                ) : null}
              </div>

              <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex min-w-0 items-center gap-1.5">
                  <UserAvatar src={d.author?.avatar_url} size={18} />
                  <span className="truncate">{d.author?.user_name ?? "—"}</span>
                </span>
                <span className="shrink-0">{dayjs(d.updated_at).format("DD/MM/YYYY")}</span>
                <span className="ms-auto flex shrink-0 items-center gap-3 tabular-nums">
                  <span className="flex items-center gap-1" title={t("likes")}>
                    <Heart className="size-3.5" />
                    {d.likes[0]?.count ?? 0}
                  </span>
                  <span className="flex items-center gap-1" title={t("comments")}>
                    <MessageSquare className="size-3.5" />
                    {d.comments[0]?.count ?? 0}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
