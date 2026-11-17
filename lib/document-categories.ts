/**
 * Danh mục tài liệu — cố định trong code (khớp check `documents_category_check` trong DB).
 * Nhãn: i18n `documents.cat_<value>`. Màu: preset Tag của antd.
 * Thêm danh mục = thêm 1 dòng ở đây + sửa check DB + nhãn i18n.
 */
export const DOCUMENT_CATEGORIES = [
  { value: "regulation", color: "red" },
  { value: "charter", color: "volcano" },
  { value: "training", color: "blue" },
  { value: "process", color: "cyan" },
  { value: "form", color: "green" },
  { value: "announcement", color: "gold" },
  { value: "other", color: "default" },
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]["value"];

export const isDocumentCategory = (v: unknown): v is DocumentCategory =>
  DOCUMENT_CATEGORIES.some((c) => c.value === v);

export const categoryColor = (v: string) => DOCUMENT_CATEGORIES.find((c) => c.value === v)?.color ?? "default";
