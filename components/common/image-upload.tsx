"use client";

import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { normalizeError } from "@/lib/errors";
import { removeImage } from "@/lib/supabase/storage";

/** Upload qua /api/upload (proxy cfig.ibytecdn.org phía server), trả public URL. */
async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("server", "server_1"); // ponytail: server CDN cố định, thêm chọn lựa khi upstream có nhiều server
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { url?: string };
    error?: { message?: string };
  };
  const url = data.data?.url;
  if (!res.ok || data.success !== true || !url) {
    throw new Error(data.error?.message || "Upload ảnh thất bại.");
  }
  return url;
}

export interface ImageUploadProps {
  /** URL ảnh hiện tại (public URL). */
  value?: string | null;
  /** Gọi khi upload xong (url) hoặc xóa (null). */
  onChange: (url: string | null) => void;
  maxSizeMb?: number;
  disabled?: boolean;
  className?: string;
  /** Nhãn hiển thị khi chưa có ảnh. */
  label?: string;
}

export function ImageUpload({
  value,
  onChange,
  maxSizeMb = 10,
  disabled,
  className,
  label = "Tải ảnh lên",
}: ImageUploadProps) {
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn tệp ảnh.");
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`Ảnh vượt quá ${maxSizeMb}MB.`);
      return;
    }
    setBusy(true);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusy(false);
      input.value = ""; // cho phép chọn lại đúng file vừa rồi
    }
  };

  const remove = (e: React.MouseEvent) => {
    e.preventDefault(); // chặn label mở lại file picker
    e.stopPropagation();
    if (!value || busy) return;
    void removeImage(value); // best-effort dọn ảnh Supabase cũ (URL ngoài bucket tự bỏ qua)
    onChange(null);
  };

  return (
    <label
      className={cn(
        "group relative flex aspect-square w-32 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30 text-muted-foreground transition-colors",
        !disabled &&
          "cursor-pointer hover:border-primary hover:text-primary focus-within:border-primary focus-within:ring-2 focus-within:ring-ring",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      {value ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="size-full object-cover" />
          {!disabled && (
            <button
              type="button"
              onClick={remove}
              aria-label="Xóa ảnh"
              className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-background/80 text-foreground opacity-0 shadow transition-opacity hover:bg-background group-hover:opacity-100 focus-visible:opacity-100"
            >
              <X className="size-4" />
            </button>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-1 px-2 text-center">
          <ImagePlus className="size-6" />
          <span className="text-xs">{label}</span>
        </div>
      )}

      {busy && (
        <div className="absolute inset-0 grid place-items-center bg-background/60">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}

      <input
        type="file"
        accept="image/*"
        disabled={disabled || busy}
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0], e.target)}
      />
    </label>
  );
}
