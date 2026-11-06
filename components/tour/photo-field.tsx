"use client";

import { useRef, useState } from "react";
import { Image, Spin } from "antd";
import { Camera, ImagePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConfirmAction } from "@/components/common/confirm-action";
import { uploadImage } from "@/components/common/image-upload";
import { normalizeError } from "@/lib/errors";
import { toast } from "@/lib/toast";

/** Thu nhỏ ảnh điện thoại (cạnh dài ≤ 1600px, JPEG) để tải lên nhanh. Lỗi → giữ file gốc. */
async function shrink(file: File, max = 1600): Promise<File> {
  if (file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) { bitmap.close(); return file; }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/**
 * Danh sách ảnh của tour + ô "Chụp". `capture` → bấm là mở camera sau của điện thoại;
 * không capture → cho chọn nhiều ảnh từ thư viện (ảnh bill…). Ảnh tải lên xong gọi `onChange` ngay.
 */
export function PhotoField({ label, value, onChange, capture, disabled }: {
  label: string;
  value: string[];
  onChange: (next: string[]) => Promise<unknown>;
  capture?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("tour");
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  const onFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setUploading(images.length);
    try {
      const urls = await Promise.all(images.map(async (f) => uploadImage(await shrink(f))));
      await onChange([...value, ...urls]);
    } catch (error) {
      toast.error(normalizeError(error).message);
    } finally {
      setUploading(0);
    }
  };

  const tile = "relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border";

  return <div className="flex flex-col gap-2">
    <span className="text-sm font-medium">
      {label} <span className="text-muted-foreground">({value.length})</span>
    </span>
    <div className="flex flex-wrap gap-2">
      <Image.PreviewGroup>
        {value.map((url) => <div key={url} className={tile}>
          <Image src={url} alt="" width={80} height={80} className="object-cover" />
          {disabled ? null : <ConfirmAction title={t("removePhoto")} okText={t("remove")} cancelText={t("cancel")}
            onConfirm={() => onChange(value.filter((u) => u !== url))}>
            <button type="button" aria-label={t("removePhoto")}
              className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white">
              <X className="size-3.5" />
            </button>
          </ConfirmAction>}
        </div>)}
      </Image.PreviewGroup>
      {Array.from({ length: uploading }, (_, i) => <div key={`u${i}`} className={`${tile} bg-muted/40`}><Spin /></div>)}
      {disabled ? null : <button type="button" disabled={uploading > 0} onClick={() => input.current?.click()}
        className={`${tile} flex-col gap-1 border-dashed bg-muted/40 text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-60`}>
        {capture ? <Camera className="size-6" /> : <ImagePlus className="size-6" />}
        {capture ? t("takePhoto") : t("addPhoto")}
      </button>}
    </div>
    <input ref={input} type="file" accept="image/*" hidden multiple={!capture}
      capture={capture ? "environment" : undefined}
      onChange={(e) => { void onFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
  </div>;
}
