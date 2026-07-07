import axios from "axios";
import { normalizeError } from "@/lib/errors";

// Axios instance dùng chung. Mọi lỗi được chuẩn hoá về AppError tại một chỗ,
// nên caller luôn nhận cùng một dạng lỗi.
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeError(error)),
);
