import { Result } from "antd";

// UI hiển thị lỗi/empty dùng chung. `children` là vùng hành động (nút/link).
export function ErrorState({
  title,
  message,
  status = "warning",
  children,
}: {
  title: string;
  message?: string;
  status?: "warning" | "404" | "403" | "500" | "error";
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Result status={status} title={title} subTitle={message} extra={children} />
    </div>
  );
}
