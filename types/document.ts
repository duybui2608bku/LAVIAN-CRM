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
  parent_id: string | null; // null = bình luận gốc; có = trả lời (chỉ 1 cấp)
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

// Phải chỉ rõ khoá ngoại: document_likes nối documents ↔ profiles nên PostgREST còn thấy quan hệ
// nhiều–nhiều → `profiles(...)` trơn bị lỗi PGRST201 (mơ hồ).
export const DOCUMENT_AUTHOR = "author:profiles!documents_created_by_fkey(user_name, avatar_url)";
export const COMMENT_AUTHOR = "author:profiles!document_comments_user_id_fkey(user_name, avatar_url)";
