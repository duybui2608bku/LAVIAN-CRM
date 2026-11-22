"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Form, Input, Modal, Select } from "antd";
import { FileText, FileUp, Trash2 } from "lucide-react";

import { Page, PageHeader } from "@/components/layout/page";
import { RichTextEditor, useRichEditor } from "@/components/documents/rich-text";
import { importGoogleDoc, saveDocument } from "@/app/(app)/documents/actions";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/document-categories";
import { normalizeError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { DOCUMENTS_BUCKET, type DocumentRecord } from "@/types/document";
import { DEPARTMENTS, type UserDepartment } from "@/types/user";

type Values = { title: string; category: DocumentCategory; departments: UserDepartment[]; pdf_path: string | null };

const MAX_PDF_MB = 30; // khớp file_size_limit của bucket

/** Trang tạo / sửa tài liệu (chỉ admin — page đã chặn). */
export function DocumentEditor({ doc }: { doc: DocumentRecord | null }) {
  const t = useTranslations("documents");
  const tu = useTranslations("users");
  const router = useRouter();
  const editor = useRichEditor(doc?.content ?? null);
  const [form] = Form.useForm<Values>();
  const [saving, startSaving] = useTransition();
  const [importOpen, setImportOpen] = useState(false);

  const save = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values || !editor) return;
    startSaving(async () => {
      const res = await saveDocument(doc?.id ?? null, {
        ...values,
        departments: values.departments ?? [],
        pdf_path: values.pdf_path ?? null,
        content: editor.isEmpty ? null : editor.getJSON(),
      });
      if (res.error !== undefined) {
        toast.error(res.error);
        return;
      }
      toast.success(t("saved"));
      router.push(`/documents/${res.id}`);
    });
  };

  return (
    <Page>
      <PageHeader
        title={doc ? t("editTitle") : t("newTitle")}
        actions={
          <>
            <Button icon={<FileText className="size-4 text-info" />} onClick={() => setImportOpen(true)}>
              {t("importGoogle")}
            </Button>
            <Link href={doc ? `/documents/${doc.id}` : "/documents"}>
              <Button className="w-full">{t("cancel")}</Button>
            </Link>
            <Button type="primary" loading={saving} disabled={!editor} onClick={save}>
              {t("save")}
            </Button>
          </>
        }
      />

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ title: doc?.title ?? "", category: doc?.category, departments: doc?.departments ?? [], pdf_path: doc?.pdf_path ?? null }}
        className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"
      >
        <div className="flex min-w-0 flex-col gap-3">
          <Form.Item
            name="title"
            className="mb-0!"
            rules={[{ required: true, whitespace: true, message: t("titleRequired") }, { max: 200 }]}
          >
            <Input size="large" placeholder={t("titlePlaceholder")} aria-label={t("titlePlaceholder")} maxLength={200} />
          </Form.Item>
          <RichTextEditor editor={editor} />
        </div>

        <aside className="surface flex flex-col gap-1 p-4 lg:sticky lg:top-18">
          <Form.Item name="category" label={t("category")} rules={[{ required: true, message: t("categoryRequired") }]}>
            <Select
              placeholder={t("categoryPlaceholder")}
              options={DOCUMENT_CATEGORIES.map((c) => ({ value: c.value, label: t(`cat_${c.value}`) }))}
            />
          </Form.Item>
          <Form.Item name="departments" label={t("departments")} extra={t("departmentsHint")}>
            <Select
              mode="multiple"
              allowClear
              placeholder={t("allDepartments")}
              options={DEPARTMENTS.map((d) => ({ value: d, label: tu(`dept_${d}`) }))}
            />
          </Form.Item>
          <Form.Item name="pdf_path" label={t("pdf")} className="mb-0!">

            <PdfField />
          </Form.Item>
        </aside>
      </Form>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(title, html) => {
          editor?.commands.setContent(html);
          if (!form.getFieldValue("title")?.trim()) form.setFieldValue("title", title);
          setImportOpen(false);
          toast.success(t("imported"));
        }}
      />
    </Page>
  );
}

/** File PDF trong bucket private `documents` — upload thẳng từ trình duyệt (policy chỉ admin ghi). */
function PdfField({ value, onChange }: { value?: string | null; onChange?: (path: string | null) => void }) {
  const t = useTranslations("documents");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.type !== "application/pdf") return toast.error(t("pdfOnly"));
    if (file.size > MAX_PDF_MB * 1024 * 1024) return toast.error(t("pdfTooLarge", { mb: MAX_PDF_MB }));
    setBusy(true);
    try {
      // ponytail: file đã tải nhưng không lưu tài liệu (huỷ / đổi file khác trước khi lưu) thành file mồ côi trong bucket — chấp nhận.
      const path = `${crypto.randomUUID()}/${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await createClient()
        .storage.from(DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: "application/pdf" });
      if (error) throw error;
      onChange?.(path);
    } catch (e) {
      toast.error(normalizeError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2">
          <FileText className="size-4 shrink-0 text-destructive" />
          <span className="min-w-0 flex-1 truncate text-sm" title={value.split("/").pop()}>
            {value.split("/").pop()}
          </span>
          <Button
            type="text"
            size="small"
            danger
            aria-label={t("removePdf")}
            icon={<Trash2 className="size-4" />}
            onClick={() => onChange?.(null)}
          />
        </div>
      ) : null}
      <Button icon={<FileUp className="size-4" />} loading={busy} onClick={() => inputRef.current?.click()}>
        {value ? t("replacePdf") : t("uploadPdf")}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
    </div>
  );
}

function ImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (title: string, html: string) => void;
}) {
  const t = useTranslations("documents");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const res = await importGoogleDoc(url);
      if (res.error !== undefined) {
        toast.error(res.error);
        return;
      }
      onImported(res.title, res.html);
      setUrl("");
    });

  return (
    <Modal
      open={open}
      title={t("importGoogle")}
      onCancel={onClose}
      onOk={run}
      okText={t("import")}
      okButtonProps={{ loading: pending, disabled: !url.trim() }}
      cancelText={t("cancel")}
      destroyOnHidden
      centered
    >
      <p className="mb-3 text-sm text-muted-foreground">{t("importHint")}</p>
      <Input
        autoFocus
        value={url}
        placeholder="https://docs.google.com/document/d/…"
        onChange={(e) => setUrl(e.target.value)}
        onPressEnter={() => url.trim() && run()}
      />
    </Modal>
  );
}

