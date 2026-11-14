"use client";

import { Button, Empty, Popover } from "antd";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";

/** Chuông thông báo ở header. Chưa có backend thông báo → luôn hiện trạng thái trống. */
export function NotificationBell() {
  const t = useTranslations("common");
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      arrow={false}
      title={t("notifications")}
      content={
        <div className="w-72 py-4">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noNotifications")} />
        </div>
      }
    >
      <Button
        type="text"
        shape="circle"
        aria-label={t("notifications")}
        title={t("notifications")}
        icon={<Bell className="size-[18px]" />}
      />
    </Popover>
  );
}
