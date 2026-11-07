import type { MetadataRoute } from "next";

import { THEME_BG } from "@/lib/ui-hints";

// Cài "Thêm vào màn hình chính" → mở toàn màn hình như app (không thanh địa chỉ).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LAVIAN CRM",
    short_name: "LAVIAN",
    description: "Hệ thống CRM LAVIAN",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: THEME_BG.light,
    theme_color: THEME_BG.light,
    lang: "vi",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
