"use client";

import { startTransition, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Input } from "antd";
import dayjs from "dayjs";
import { ArrowLeft, ExternalLink, FileText, Heart, Pencil, SendHorizontal, Trash2 } from "lucide-react";

import { ConfirmAction } from "@/components/common/confirm-action";
import { UserAvatar } from "@/components/common/user-avatar";
import { RichTextView } from "@/components/documents/rich-text";
import { Page } from "@/components/layout/page";
import { addComment, deleteComment, setLike } from "@/app/(app)/documents/actions";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { DocumentComment, DocumentRecord } from "@/types/document";

const when = (iso: string) => dayjs(iso).format("DD/MM/YYYY HH:mm");

export function DocumentView({
  doc,
  comments,
  likeCount,
  liked,
  pdfUrl,
  currentUserId,
  isAdmin,
}: {
  doc: DocumentRecord;
  comments: DocumentComment[];
  likeCount: number;
  liked: boolean;
  pdfUrl: string | null;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const t = useTranslations("documents");

  return (
    <Page className="mx-auto max-w-4xl">
      <div className="flex items-center gap-2">
        <Link href="/documents" className="flex items-center gap-1 text-sm text-muted-foreground! hover:text-foreground!">
          <ArrowLeft className="size-4" />
          {t("title")}
        </Link>
        {isAdmin ? (
          <Link href={`/documents/${doc.id}/edit`} className="ms-auto">
            <Button size="small" icon={<Pencil className="size-3.5" />}>
              {t("edit")}
            </Button>
          </Link>
        ) : null}
      </div>

      <article className="surface overflow-clip">
        <header className="border-b border-border px-4 py-4 sm:px-8 sm:py-6">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{doc.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <UserAvatar src={doc.author?.avatar_url} size={20} />
            <span>{doc.author?.user_name ?? "—"}</span>
            <span aria-hidden>·</span>
            <span>{t("updatedAt", { date: when(doc.updated_at) })}</span>
          </p>
        </header>

        {pdfUrl ? <PdfBlock url={pdfUrl} name={doc.pdf_path?.split("/").pop() ?? "PDF"} /> : null}

        {doc.content ? (
          <div className="px-4 py-5 sm:px-8 sm:py-6">
            <RichTextView content={doc.content} />
          </div>
        ) : null}

        <footer className="border-t border-border px-4 py-3 sm:px-8">
          <LikeButton documentId={doc.id} liked={liked} count={likeCount} />
        </footer>
      </article>

      <Comments documentId={doc.id} comments={comments} currentUserId={currentUserId} isAdmin={isAdmin} />
    </Page>
  );
}

function PdfBlock({ url, name }: { url: string; name: string }) {
  const t = useTranslations("documents");
  return (
    <section className="border-b border-border">
      <div className="flex items-center gap-2 px-4 py-2.5 sm:px-8">
        <FileText className="size-4 shrink-0 text-destructive" />
        <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button size="small" icon={<ExternalLink className="size-3.5" />}>
            {t("openPdf")}
          </Button>
        </a>
      </div>
      {/* Trình duyệt điện thoại không hiển thị PDF trong iframe → chỉ nút mở tab mới. */}
      <iframe src={url} title={name} className="block h-[80vh] w-full border-0 bg-muted max-sm:hidden" />
    </section>
  );
}

function LikeButton({ documentId, liked, count }: { documentId: string; liked: boolean; count: number }) {
  const t = useTranslations("documents");
  const [state, setOptimistic] = useOptimistic({ liked, count });

  const toggle = () =>
    startTransition(async () => {
      const next = !state.liked;
      setOptimistic({ liked: next, count: state.count + (next ? 1 : -1) });
      const res = await setLike(documentId, next);
      if (res.error !== undefined) toast.error(res.error);
    });

  return (
    <Button
      type="text"
      onClick={toggle}
      aria-pressed={state.liked}
      icon={<Heart className={cn("size-4", state.liked && "fill-current text-destructive")} />}
      className={cn("-ms-2", state.liked && "text-destructive!")}
    >
      <span className="tabular-nums">{state.count}</span>
      <span>{t(state.liked ? "liked" : "like")}</span>
    </Button>
  );
}

function Comments({
  documentId,
  comments,
  currentUserId,
  isAdmin,
}: {
  documentId: string;
  comments: DocumentComment[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const t = useTranslations("documents");
  const [body, setBody] = useState("");
  const [sending, startSending] = useTransition();

  const send = () => {
    if (!body.trim()) return;
    startSending(async () => {
      const res = await addComment(documentId, body);
      if (res.error !== undefined) toast.error(res.error);
      else setBody("");
    });
  };

  return (
    <section className="surface flex flex-col gap-4 p-4 sm:px-8 sm:py-6" aria-labelledby="comments-title">
      <h2 id="comments-title" className="font-semibold">
        {t("commentsTitle", { count: comments.length })}
      </h2>

      {comments.length ? (
        <ul className="flex flex-col gap-4">
          {comments.map((c) => (
            <li key={c.id} className="group flex gap-3">
              <UserAvatar src={c.author?.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-medium">{c.author?.user_name ?? "—"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{when(c.created_at)}</span>
                  {c.user_id === currentUserId || isAdmin ? (
                    <ConfirmAction
                      title={t("deleteCommentConfirm")}
                      okText={t("delete")}
                      cancelText={t("cancel")}
                      onConfirm={async () => {
                        const res = await deleteComment(c.id);
                        if (res.error !== undefined) toast.error(res.error);
                      }}
                    >
                      <Button
                        type="text"
                        size="small"
                        aria-label={t("deleteComment")}
                        icon={<Trash2 className="size-3.5" />}
                        className="ms-auto text-muted-foreground! opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                      />
                    </ConfirmAction>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noComments")}</p>
      )}

      <div className="flex items-end gap-2">
        <Input.TextArea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
          }}
          placeholder={t("commentPlaceholder")}
          aria-label={t("commentPlaceholder")}
          autoSize={{ minRows: 1, maxRows: 6 }}
          maxLength={2000}
        />
        <Button
          type="primary"
          loading={sending}
          disabled={!body.trim()}
          onClick={send}
          aria-label={t("send")}
          icon={<SendHorizontal className="size-4" />}
        />
      </div>
    </section>
  );
}
