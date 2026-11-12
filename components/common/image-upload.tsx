"use client";

import { useRef, useState } from "react";
import { Button, Spin } from "antd";
import { ImagePlus, X } from "lucide-react";

import { normalizeError } from "@/lib/errors";
import { removeImage } from "@/lib/supabase/storage";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Upload qua /api/upload (proxy cfig.ibytecdn.org phía server), trả public URL. */
export async function uploadImage(file: File): Promise<string> {
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
  onChange?: (url: string | null) => void;
  maxSizeMb?: number;
  disabled?: boolean;
  className?: string;
  /** Nhãn hiển thị khi chưa có ảnh. */
  label?: string;
  /**
   * Chế độ dán ảnh: click 1 lần = chọn ô (focus) rồi Ctrl+V để dán ảnh từ clipboard,
   * double-click = mở hộp chọn file. Mặc định (false): click 1 lần mở hộp chọn file.
   */
  paste?: boolean;
}

/** Ô vuông upload 1 ảnh: chọn file, hoặc dán từ clipboard khi bật `paste`. */
export function ImageUpload({
  value,
  onChange,
  maxSizeMb = 10,
  disabled,
  className,
  label = "Tải ảnh lên",
  paste = false,
}: ImageUploadProps) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const locked = disabled || busy;

  const onFile = async (file: File) => {
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
      onChange?.(await uploadImage(file));
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const pick = () => {
    if (!locked) inputRef.current?.click();
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (locked) return;
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    e.preventDefault();
    void onFile(file);
  };

  const remove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value || busy) return;
    void removeImage(value); // best-effort dọn ảnh Supabase cũ (URL ngoài bucket tự bỏ qua)
    onChange?.(null);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // chọn lại đúng file cũ vẫn kích hoạt onChange
          if (file) void onFile(file);
        }}
      />
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-disabled={disabled}
        onClick={paste ? undefined : pick}
        onDoubleClick={paste ? pick : undefined}
        onPaste={paste ? onPaste : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick();
          }
        }}
        className={cn(
          "group relative flex aspect-square w-32 items-center justify-center overflow-hidden rounded border border-dashed border-border bg-muted/40 text-muted-foreground outline-none transition-colors",
          !disabled && "cursor-pointer hover:border-primary hover:text-primary",
          // Chế độ dán: ô đang chọn viền liền + màu primary để biết Ctrl+V sẽ vào đây.
          !disabled && "focus-visible:border-primary",
          paste && !disabled && "focus:border-solid focus:border-primary focus:text-primary",
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
      >
        {busy && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <Spin />
          </div>
        )}
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="size-full object-cover" draggable={false} />
            {!disabled && (
              <Button
                size="small"
                shape="circle"
                aria-label="Xóa ảnh"
                icon={<X className="size-3.5" />}
                onClick={remove}
                onDoubleClick={(e) => e.stopPropagation()}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 px-2 text-center">
            <ImagePlus className="size-6" />
            <span className="text-xs">{label}</span>
          </div>
        )}
      </div>
    </>
  );
}
