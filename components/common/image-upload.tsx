"use client";

import { useState } from "react";
import { Button, Spin, Upload } from "antd";
import { ImagePlus, X } from "lucide-react";

import { normalizeError } from "@/lib/errors";
import { removeImage } from "@/lib/supabase/storage";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

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
  onChange?: (url: string | null) => void;
  maxSizeMb?: number;
  disabled?: boolean;
  className?: string;
  /** Nhãn hiển thị khi chưa có ảnh. */
  label?: string;
}

/** Ô vuông upload 1 ảnh (antd Upload, tự gửi file — không dùng action mặc định). */
export function ImageUpload({
  value,
  onChange,
  maxSizeMb = 10,
  disabled,
  className,
  label = "Tải ảnh lên",
}: ImageUploadProps) {
  const [busy, setBusy] = useState(false);

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

  const remove = (e: React.MouseEvent) => {
    e.stopPropagation(); // chặn mở lại file picker
    if (!value || busy) return;
    void removeImage(value); // best-effort dọn ảnh Supabase cũ (URL ngoài bucket tự bỏ qua)
    onChange?.(null);
  };

  return (
    <Upload
      accept="image/*"
      showUploadList={false}
      disabled={disabled || busy}
      beforeUpload={(file) => {
        void onFile(file);
        return false; // tự upload, không để antd POST
      }}
    >
      <Spin spinning={busy}>
        <div
          className={cn(
            "group relative flex aspect-square w-32 items-center justify-center overflow-hidden rounded border border-dashed border-border bg-muted/40 text-muted-foreground transition-colors",
            !disabled && "cursor-pointer hover:border-primary hover:text-primary",
            disabled && "cursor-not-allowed opacity-60",
            className,
          )}
        >
          {value ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="" className="size-full object-cover" />
              {!disabled && (
                <Button
                  size="small"
                  shape="circle"
                  aria-label="Xóa ảnh"
                  icon={<X className="size-3.5" />}
                  onClick={remove}
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
      </Spin>
    </Upload>
  );
}
