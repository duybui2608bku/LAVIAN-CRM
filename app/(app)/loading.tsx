"use client"; // Skeleton.Input/Button là thuộc tính của export client — không chấm được ở server

import { Skeleton } from "antd";

import { Page } from "@/components/layout/page";

/**
 * Khung xương cho mọi trang trong shell — hiện NGAY khi bấm điều hướng, thay vì
 * đứng hình chờ query server xong.
 * ponytail: một khung dùng chung; tách riêng theo route nếu bố cục lệch hẳn.
 */
export default function Loading() {
  return (
    <Page>
      <div className="flex items-start justify-between gap-3">
        <Skeleton.Input active />
        <Skeleton.Button active />
      </div>
      <div className="flex flex-wrap gap-2">
        {[220, 140, 140, 240].map((w) => (
          <Skeleton.Input key={w} active size="small" style={{ width: w }} />
        ))}
      </div>
      <div className="surface p-4">
        <Skeleton active paragraph={{ rows: 8 }} title={false} />
      </div>
    </Page>
  );
}
