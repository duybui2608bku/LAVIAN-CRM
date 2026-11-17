import type { JSONContent } from "@tiptap/react";

import type { UserDepartment } from "@/types/user";

type Author = { user_name: string; avatar_url: string | null } | null;

/** Dòng danh sách `/documents` (kèm số like/bình luận). */
export interface DocumentListItem {
  id: string;
  title: string;
  pdf_path: string | null;
  departments: UserDepartment[]; // rỗng = mọi bộ phận
  updated_at: string;
  author: Author;
  likes: { count: number }[];
  comments: { count: number }[];
}

/** Tài liệu đầy đủ (trang xem / sửa). */
export interface DocumentRecord {
  id: string;
  title: string;
  content: JSONContent | null; // JSON Tiptap
  pdf_path: string | null; // object name trong bucket private `documents`
  departments: UserDepartment[];
  created_at: string;
  updated_at: string;
  author: Author;
}

export interface DocumentComment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: Author;
}

export interface DocumentInput {
  title: string;
  content: JSONContent | null;
  pdf_path: string | null;
  departments: UserDepartment[];
}

export const DOCUMENTS_BUCKET = "documents";
