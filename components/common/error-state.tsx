// UI hiển thị lỗi/empty dùng chung. `children` là vùng hành động (nút/link).
export function ErrorState({
  title,
  message,
  children,
}: {
  title: string;
  message?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {message && <p className="max-w-md text-muted-foreground">{message}</p>}
      {children}
    </div>
  );
}
