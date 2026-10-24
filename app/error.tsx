"use client"; // Error boundary phải là Client Component

import { useEffect } from "react";
import { Button } from "antd";
import { useTranslations } from "next-intl";

import { ErrorState } from "@/components/common/error-state";

// Next 16: prop là `unstable_retry` (không còn `reset`).
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      status="500"
      title={t("genericTitle")}
      message={error.message || t("genericBody")}
    >
      <Button onClick={() => unstable_retry()}>{t("retry")}</Button>
    </ErrorState>
  );
}
