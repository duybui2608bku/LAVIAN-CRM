"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Divider, Input, Popover, Tooltip } from "antd";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";

import { uploadImage } from "@/components/common/image-upload";
import { normalizeError } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// Dùng chung cho editor + trang xem: nội dung luôn đi qua schema này (thẻ/thuộc tính lạ bị bỏ, link `javascript:` bị chặn)
// nên hiển thị an toàn mà không cần dangerouslySetInnerHTML.
const extensions = [
  StarterKit.configure({ link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
  Image,
];

const MAX_IMAGE_MB = 10;

/** Upload các file ảnh rồi chèn vào vị trí con trỏ (hoặc `pos` khi kéo thả). */
async function insertImages(editor: Editor, files: File[], pos?: number) {
  const images = files.filter((f) => f.type.startsWith("image/"));
  for (const file of images) {
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`${file.name}: > ${MAX_IMAGE_MB}MB`);
      continue;
    }
    try {
      const src = await uploadImage(file);
      const node = { type: "image", attrs: { src, alt: file.name } };
      if (pos === undefined) editor.chain().focus().insertContent(node).run();
      else editor.chain().insertContentAt(pos, node).run();
    } catch (e) {
      toast.error(normalizeError(e).message);
    }
  }
  return images.length > 0;
}

/** Editor soạn tài liệu — trang cha giữ instance để đọc JSON khi lưu / đổ nội dung import. */
export function useRichEditor(initial: JSONContent | null) {
  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    extensions,
    content: initial ?? "",
    immediatelyRender: false,
    onCreate: ({ editor: e }) => {
      editorRef.current = e;
    },
    editorProps: {
      attributes: { class: "rich-text min-h-[50vh] px-4 py-3 outline-none sm:px-6" },
      // Dán / kéo thả ảnh từ máy → upload CDN. Ảnh kèm HTML (dán từ web/Docs) để editor tự xử lý.
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!editorRef.current || !files.some((f) => f.type.startsWith("image/"))) return false;
        void insertImages(editorRef.current, files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (!editorRef.current || !files.some((f) => f.type.startsWith("image/"))) return false;
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImages(editorRef.current, files, pos);
        return true;
      },
    },
  });
  return editor;
}

/** Khung soạn thảo: toolbar dính đầu + vùng nội dung. */
export function RichTextEditor({ editor, className }: { editor: Editor | null; className?: string }) {
  return (
    // overflow-clip (không phải hidden) để toolbar sticky vẫn bám theo trang.
    <div className={cn("surface overflow-clip", className)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

/** Hiển thị nội dung (chỉ đọc). */
export function RichTextView({ content }: { content: JSONContent }) {
  const editor = useEditor({
    extensions,
    content,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: "rich-text outline-none" } },
  });
  // Trước khi editor dựng xong (chỉ ở client) giữ chỗ để trang không giật.
  if (!editor) return <div className="min-h-40" />;
  return <EditorContent editor={editor} />;
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const t = useTranslations("documents");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Toolbar tự re-render theo vùng chọn (editor không re-render mỗi transaction).
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e && {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        h1: e.isActive("heading", { level: 1 }),
        h2: e.isActive("heading", { level: 2 }),
        h3: e.isActive("heading", { level: 3 }),
        bullet: e.isActive("bulletList"),
        ordered: e.isActive("orderedList"),
        quote: e.isActive("blockquote"),
        link: e.isActive("link"),
        href: (e.getAttributes("link").href as string | undefined) ?? "",
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      },
  });

  if (!editor || !state) return <div className="h-11 border-b border-border" />;
  const chain = () => editor.chain().focus();

  const btn = (label: string, icon: React.ReactNode, onClick: () => void, active = false, disabled = false) => (
    <Tooltip title={label} key={label}>
      <Button
        type={active ? "primary" : "text"}
        ghost={active}
        size="small"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        icon={icon}
        onClick={onClick}
      />
    </Tooltip>
  );
  const sep = (key: string) => <Divider key={key} orientation="vertical" className="mx-0.5! h-5!" />;
  const i = "size-4";

  return (
    // Dính ngay dưới header của AppShell (điện thoại 52px + safe-area, desktop 56px).
    <div className="sticky top-[calc(3.25rem+1px+env(safe-area-inset-top))] z-10 flex flex-wrap md:top-14 items-center gap-0.5 border-b border-border bg-card px-2 py-1.5">
      {btn(t("undo"), <Undo2 className={i} />, () => chain().undo().run(), false, !state.canUndo)}
      {btn(t("redo"), <Redo2 className={i} />, () => chain().redo().run(), false, !state.canRedo)}
      {sep("s1")}
      {btn(t("h1"), <Heading1 className={i} />, () => chain().toggleHeading({ level: 1 }).run(), state.h1)}
      {btn(t("h2"), <Heading2 className={i} />, () => chain().toggleHeading({ level: 2 }).run(), state.h2)}
      {btn(t("h3"), <Heading3 className={i} />, () => chain().toggleHeading({ level: 3 }).run(), state.h3)}
      {sep("s2")}
      {btn(t("bold"), <Bold className={i} />, () => chain().toggleBold().run(), state.bold)}
      {btn(t("italic"), <Italic className={i} />, () => chain().toggleItalic().run(), state.italic)}
      {btn(t("underline"), <Underline className={i} />, () => chain().toggleUnderline().run(), state.underline)}
      {btn(t("strike"), <Strikethrough className={i} />, () => chain().toggleStrike().run(), state.strike)}
      {sep("s3")}
      {btn(t("bulletList"), <List className={i} />, () => chain().toggleBulletList().run(), state.bullet)}
      {btn(t("orderedList"), <ListOrdered className={i} />, () => chain().toggleOrderedList().run(), state.ordered)}
      {btn(t("quote"), <Quote className={i} />, () => chain().toggleBlockquote().run(), state.quote)}
      {btn(t("divider"), <Minus className={i} />, () => chain().setHorizontalRule().run())}
      {sep("s4")}
      <LinkButton key="link" editor={editor} active={state.link} href={state.href} />
      <Tooltip title={t("image")} key="image">
        <Button
          type="text"
          size="small"
          aria-label={t("image")}
          loading={uploading}
          icon={<ImagePlus className={i} />}
          onClick={() => fileRef.current?.click()}
        />
      </Tooltip>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          setUploading(true);
          await insertImages(editor, files);
          setUploading(false);
        }}
      />
      {btn(t("clearFormat"), <RemoveFormatting className={i} />, () => chain().unsetAllMarks().clearNodes().run())}
    </div>
  );
}

function LinkButton({ editor, active, href }: { editor: Editor; active: boolean; href: string }) {
  const t = useTranslations("documents");
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const apply = () => {
    const value = url.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (value) chain.setLink({ href: value }).run();
    else chain.unsetLink().run();
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setUrl(href);
      }}
      trigger="click"
      content={
        <div className="flex w-72 gap-2">
          <Input
            autoFocus
            value={url}
            placeholder="https://"
            onChange={(e) => setUrl(e.target.value)}
            onPressEnter={apply}
          />
          <Button type="primary" onClick={apply}>
            {t("ok")}
          </Button>
        </div>
      }
    >
      <Tooltip title={t("link")}>
        <Button
          type={active ? "primary" : "text"}
          ghost={active}
          size="small"
          aria-label={t("link")}
          aria-pressed={active}
          icon={<Link2 className="size-4" />}
        />
      </Tooltip>
    </Popover>
  );
}
