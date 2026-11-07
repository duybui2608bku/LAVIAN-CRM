"use client";

import { Image, Modal } from "antd";
import { Images } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Tour } from "@/types/tour";

export const photoCount = (t: Tour) => t.before_images.length + t.after_images.length + t.extra_images.length;

/** Nút icon ảnh + số lượng; bấm mở modal xem ảnh (không lan click lên hàng/thẻ). */
export function PhotoCountButton({ tour, onOpen }: { tour: Tour; onOpen: (id: string) => void }) {
  const t = useTranslations("tour");
  const count = photoCount(tour);
  const inner = <><Images className="size-4" />{count}</>;
  if (!count) return <span className="flex items-center gap-1 text-muted-foreground">{inner}</span>;
  return <button type="button" aria-label={t("photos")}
    className="-mx-1.5 -my-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-primary hover:bg-muted"
    onClick={(e) => { e.stopPropagation(); onOpen(tour.id); }}>
    {inner}
  </button>;
}

/** Modal xem ảnh của 1 tour, chia theo nhóm Trước / Sau / Thêm; bấm ảnh để phóng to, lướt qua cả 3 nhóm. */
export function TourPhotosModal({ tour, onClose }: { tour: Tour | undefined; onClose: () => void }) {
  const t = useTranslations("tour");
  const groups = tour ? [
    { label: t("beforePhotos"), urls: tour.before_images },
    { label: t("afterPhotos"), urls: tour.after_images },
    { label: t("extraPhotos"), urls: tour.extra_images },
  ].filter((g) => g.urls.length) : [];

  return <Modal open={!!tour} onCancel={onClose} footer={null} width={640} destroyOnHidden
    title={`${t("photos")} · ${tour?.customer?.full_name ?? ""}`}>
    <Image.PreviewGroup>
      <div className="flex flex-col gap-4">
        {groups.map((g) => <section key={g.label} className="flex flex-col gap-2">
          <span className="text-sm font-medium">{g.label} <span className="text-muted-foreground">({g.urls.length})</span></span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {g.urls.map((url) => <div key={url} className="aspect-square overflow-hidden rounded-lg border border-border">
              <Image src={url} alt="" rootClassName="size-full" className="size-full! object-cover" />
            </div>)}
          </div>
        </section>)}
      </div>
    </Image.PreviewGroup>
  </Modal>;
}
