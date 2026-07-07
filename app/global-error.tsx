"use client"; // Error boundary phải là Client Component

// Thay thế root layout → nằm NGOÀI NextIntlClientProvider, dùng text tĩnh
// song ngữ (giới hạn đã biết của Next.js). Phải tự khai báo <html>/<body>.
export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="vi">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center font-sans antialiased">
        <h2 className="text-2xl font-semibold tracking-tight">
          Đã có lỗi xảy ra
        </h2>
        <p className="max-w-md text-neutral-500">
          Đã xảy ra lỗi không mong muốn. / An unexpected error occurred.
        </p>
        <button
          onClick={() => unstable_retry()}
          className="h-8 rounded-lg border px-3 text-sm hover:bg-neutral-100"
        >
          Thử lại / Try again
        </button>
      </body>
    </html>
  );
}
