"use client";

import { useState } from "react";
import { Alert, Button, Image, Skeleton, Upload } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { addAppointmentPhoto, deleteAppointmentPhoto, getAppointmentPhotos } from "@/app/(app)/customers/customer-360-actions";
import { ConfirmAction } from "@/components/common/confirm-action";
import { useCurrentUserId } from "@/components/common/permissions";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Ảnh Trước/Sau của 1 lịch (Drawer Sales, không bắt buộc). Client tải file thẳng lên bucket riêng tư `ba-photos`
 * (Server Action giới hạn body 1MB) rồi gọi action ghi dòng; xem bằng signed URL. Người tải lên xoá được ảnh của mình.
 */
export function AppointmentPhotos({ appointmentId, customerId, canEdit }: { appointmentId: string; customerId: string; canEdit: boolean }) {
  const t = useTranslations("c360.photos");
  const me = useCurrentUserId();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<"before" | "after" | null>(null);
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["appointment-photos", appointmentId],
    queryFn: async () => {
      const res = await getAppointmentPhotos(appointmentId);
      if (res.error) throw new Error(res.error);
      return res.photos ?? [];
    },
  });
  const changed = () => { refetch(); qc.invalidateQueries({ queryKey: ["customer-360", customerId] }); };

  const upload = async (kind: "before" | "after", file: File) => {
    if (!file.type.startsWith("image/")) return toast.error(t("notImage"));
    if (file.size > MAX_BYTES) return toast.error(t("tooLarge"));
    setUploading(kind);
    try {
      const ext = file.type.split("/")[1].replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${customerId}/${appointmentId}/${crypto.randomUUID()}.${ext}`;
      const storage = createClient().storage.from("ba-photos");
      const { error: upErr } = await storage.upload(path, file, { contentType: file.type });
      if (upErr) return toast.error(upErr.message);
      const res = await addAppointmentPhoto(appointmentId, kind, path);
      if (res.error) { await storage.remove([path]); return toast.error(res.error); }
      toast.success(t("uploaded"));
      changed();
    } finally {
      setUploading(null);
    }
  };
  const remove = async (id: string) => {
    const res = await deleteAppointmentPhoto(id);
    if (res.error) return toast.error(res.error);
    toast.success(t("deleted"));
    changed();
  };

  if (isPending) return <Skeleton.Image active />;
  if (error) return <Alert type="error" showIcon title={error.message} />;
  return <Image.PreviewGroup>
    <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
      {(["before", "after"] as const).map((kind) => <div key={kind}>
        <div className="mb-2 text-sm font-medium">{t(kind)}</div>
        <div className="flex flex-wrap gap-2">
          {data.filter((p) => p.kind === kind).map((p) => <div key={p.id} className="relative">
            <Image src={p.url} alt={t(kind)} width={96} height={96} className="rounded-lg object-cover" />
            {p.created_by === me && <ConfirmAction title={t("deleteConfirm")} onConfirm={() => remove(p.id)}>
              <Button size="small" danger aria-label={t("delete")} title={t("delete")} className="absolute end-1 top-1"
                icon={<Trash2 className="size-3.5" />} />
            </ConfirmAction>}
          </div>)}
          {canEdit && <Upload accept="image/*" showUploadList={false} multiple
            beforeUpload={(file) => { void upload(kind, file); return false; }}>
            <Button loading={uploading === kind} icon={<ImagePlus className="size-4" />} className="size-24 flex-col">
              <span className="text-xs">{t("upload", { kind: t(kind) })}</span>
            </Button>
          </Upload>}
        </div>
      </div>)}
    </div>
  </Image.PreviewGroup>;
}
