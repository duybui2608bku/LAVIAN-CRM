import axios from "axios";
import { ZodError } from "zod";

const FALLBACK_MESSAGE = "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.";

/** Lỗi chuẩn hoá dùng chung toàn app. */
export class AppError extends Error {
  code: string;
  status?: number;

  constructor(
    message: string,
    options?: { code?: string; status?: number; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = options?.code ?? "UNKNOWN";
    this.status = options?.status;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Gom lỗi từ mọi nguồn (Axios / Supabase / Zod / Error / giá trị lạ) về một
 * `AppError`. Luôn trả về AppError, không bao giờ ném thêm.
 */
export function normalizeError(err: unknown): AppError {
  if (isAppError(err)) return err;

  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data as
      | { message?: string; error?: string }
      | undefined;
    const message =
      data?.message ?? data?.error ?? err.message ?? FALLBACK_MESSAGE;
    return new AppError(message, {
      code: err.code ?? "AXIOS_ERROR",
      status,
      cause: err,
    });
  }

  if (err instanceof ZodError) {
    const message =
      err.issues.map((i) => i.message).join("; ") || FALLBACK_MESSAGE;
    return new AppError(message, {
      code: "VALIDATION_ERROR",
      status: 400,
      cause: err,
    });
  }

  // Supabase (PostgrestError là object thường, AuthError là Error) — nhận diện
  // qua các field đặc trưng để không nuốt nhầm Error generic.
  // ponytail: heuristic theo field; đủ cho supabase-js v2.
  if (
    isRecord(err) &&
    typeof err.message === "string" &&
    ("code" in err || "status" in err || "details" in err || "hint" in err)
  ) {
    return new AppError(err.message, {
      code: typeof err.code === "string" ? err.code : "SUPABASE_ERROR",
      status: typeof err.status === "number" ? err.status : undefined,
      cause: err,
    });
  }

  if (err instanceof Error) {
    return new AppError(err.message || FALLBACK_MESSAGE, {
      code: "ERROR",
      cause: err,
    });
  }

  return new AppError(FALLBACK_MESSAGE, { code: "UNKNOWN" });
}
