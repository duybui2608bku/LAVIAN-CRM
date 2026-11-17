"use client";

import { startTransition, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Input, Tag } from "antd";
import dayjs from "dayjs";
import { ArrowLeft, ExternalLink, FileText, Heart, Pencil, SendHorizontal, Trash2 } from "lucide-react";

import { ConfirmAction } from "@/components/common/confirm-action";
import { UserAvatar } from "@/components/common/user-avatar";
import { RichTextView } from "@/components/documents/rich-text";
import { Page } from "@/components/layout/page";
import { addComment, deleteComment, setLike } from "@/app/(app)/documents/actions";
import { categoryColor } from "@/lib/document-categories";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { DocumentComment, DocumentRecord } from "@/types/document";

const when = (iso: string) => dayjs(iso).format("DD/MM/YYYY HH:mm");

type CurrentUser = { id: string; user_name: string; avatar_url: string | null };

export function DocumentView({
  doc,
  comments,
  likeCount,
  liked,
  pdfUrl,
  currentUser,
  isAdmin,
}: {
  doc: DocumentRecord;
  comments: DocumentComment[];
  likeCount: number;
  liked: boolean;
  pdfUrl: string | null;
  currentUser: CurrentUser;
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
            <Tag color={categoryColor(doc.category)} variant="filled" className="m-0! ms-1!">
              {t(`cat_${doc.category}`)}
            </Tag>
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

      <Comments documentId={doc.id} comments={comments} currentUser={currentUser} isAdmin={isAdmin} />
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
      {/* Chỉ hiện trang PDF: ẩn thanh công cụ + ô ảnh trang của trình xem Chrome/Edge, trang vừa chiều ngang.
          Trình duyệt điện thoại không hiển thị PDF trong iframe → chỉ nút mở tab mới. */}
      <iframe
        src={`${url}#toolbar=0&navpanes=0&view=FitH`}
        title={name}
        className="block h-[80vh] w-full border-0 bg-muted max-sm:hidden"
      />
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
  currentUser,
  isAdmin,
}: {
  documentId: string;
  comments: DocumentComment[];
  currentUser: CurrentUser;
  isAdmin: boolean;
}) {
  const t = useTranslations("documents");
  // Đang trả lời luồng nào (id bình luận gốc) + tên người được trả lời (placeholder).
  const [replyTo, setReplyTo] = useState<{ rootId: string; name: string } | null>(null);

  const roots = comments.filter((c) => !c.parent_id);
  const replies = (rootId: string) => comments.filter((c) => c.parent_id === rootId);

  const item = (c: DocumentComment, rootId: string, small = false) => (
    <CommentItem
      key={c.id}
      comment={c}
      small={small}
      canDelete={c.user_id === currentUser.id || isAdmin}
      hasReplies={!small && replies(c.id).length > 0}
      onReply={() => setReplyTo({ rootId, name: c.author?.user_name ?? "" })}
    />
  );

  return (
    <section className="surface flex flex-col gap-4 p-4 sm:px-8 sm:py-6" aria-labelledby="comments-title">
      <h2 id="comments-title" className="font-semibold">
        {t("commentsTitle", { count: comments.length })}
      </h2>

      {roots.length ? (
        <ul className="flex flex-col gap-4">
          {roots.map((root) => (
            <li key={root.id} className="flex flex-col gap-3">
              {item(root, root.id)}
              {replies(root.id).length || replyTo?.rootId === root.id ? (
                // Trả lời thụt vào thẳng hàng với nội dung bình luận gốc (avatar 32px + gap 12px).
                <div className="ms-11 flex flex-col gap-3">
                  {replies(root.id).map((r) => item(r, root.id, true))}
                  {replyTo?.rootId === root.id ? (
                    <Composer
                      key={replyTo.name}
                      user={currentUser}
                      small
                      autoFocus
                      placeholder={t("replyPlaceholder", { name: replyTo.name })}
                      onSend={(body) => addComment(documentId, body, root.id)}
                      onSent={() => setReplyTo(null)}
                      onCancel={() => setReplyTo(null)}
                    />
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noComments")}</p>
      )}

      <Composer
        user={currentUser}
        placeholder={t("commentPlaceholder")}
        onSend={(body) => addComment(documentId, body)}
      />
    </section>
  );
}

function CommentItem({
  comment: c,
  small,
  canDelete,
  hasReplies,
  onReply,
}: {
  comment: DocumentComment;
  small: boolean;
  canDelete: boolean;
  hasReplies: boolean;
  onReply: () => void;
}) {
  const t = useTranslations("documents");
  return (
    <div className="group flex gap-3">
      <UserAvatar src={c.author?.avatar_url} size={small ? 24 : 32} />
      <div className="min-w-0 flex-1">
        <div className="w-fit max-w-full rounded-2xl bg-muted px-3 py-2">
          <div className="truncate text-sm font-semibold">{c.author?.user_name ?? "—"}</div>
          <p className="text-sm whitespace-pre-wrap break-words">{c.body}</p>
        </div>
        <div className="mt-1 flex items-center gap-1 ps-3 text-xs text-muted-foreground">
          <span>{when(c.created_at)}</span>
          <Button type="link" size="small" className="h-auto! px-1.5! text-xs! font-semibold" onClick={onReply}>
            {t("reply")}
          </Button>
          {canDelete ? (
            <ConfirmAction
              title={hasReplies ? t("deleteThreadConfirm") : t("deleteCommentConfirm")}
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
                className="text-muted-foreground! opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
              />
            </ConfirmAction>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Ô viết bình luận / trả lời: avatar người đang đăng nhập + ô nhập + nút gửi (Ctrl+Enter gửi, Esc huỷ trả lời). */
function Composer({
  user,
  placeholder,
  small,
  autoFocus,
  onSend,
  onSent,
  onCancel,
}: {
  user: CurrentUser;
  placeholder: string;
  small?: boolean;
  autoFocus?: boolean;
  onSend: (body: string) => Promise<{ error?: string }>;
  onSent?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("documents");
  const [body, setBody] = useState("");
  const [sending, startSending] = useTransition();

  const send = () => {
    if (!body.trim()) return;
    startSending(async () => {
      const res = await onSend(body);
      if (res.error !== undefined) return void toast.error(res.error);
      setBody("");
      onSent?.();
    });
  };

  return (
    <div className="flex items-start gap-3">
      <UserAvatar src={user.avatar_url} size={small ? 24 : 32} />
      <div className="flex min-w-0 flex-1 items-end gap-2">
        <Input.TextArea
          value={body}
          autoFocus={autoFocus}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
            if (e.key === "Escape") onCancel?.();
          }}
          placeholder={placeholder}
          aria-label={placeholder}
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
    </div>
  );
}
