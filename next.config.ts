import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Ẩn log của các request Socket.IO polling do extension/service worker
  // trình duyệt bắn vào (app không phát loại này). Chỉ ảnh hưởng log dev.
  logging: {
    incomingRequests: {
      ignore: [/[?&](?:EIO=|transport=polling|X_LOCAL_SECURITY_COOKIE)/],
    },
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
