"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/hooks/use-i18n";
import { captureClientError } from "@/infrastructure/error-monitoring-repository";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    captureClientError(error, {
      eventType: "react_render_error",
      operation: "next.route-error",
      properties: {
        runtime: "next",
        source: "app-error"
      },
      severity: "fatal"
    });
  }, [error]);

  return (
    <main className="runtime-error-screen">
      <section className="runtime-error-panel" role="alert">
        <span className="runtime-error-kicker">{t("settings.error.kicker")}</span>
        <h1>{t("settings.error.title")}</h1>
        <p>{t("settings.error.description")}</p>
        <div className="runtime-error-actions">
          <button className="utility-button" type="button" onClick={reset}>
            {t("settings.error.retry")}
          </button>
          <Link className="utility-button" href="/">
            {t("settings.error.backHome")}
          </Link>
        </div>
      </section>
    </main>
  );
}
