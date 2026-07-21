"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ReadOnlyHomeRenderer,
  ReadOnlyHomeRendererBoundary,
  type ReadOnlyHomeRendererStatus
} from "@/components/read-only-home-renderer";
import type { PublicHomeDocumentV1 } from "@/domain/public-home-document";
import { isPublicHomeShareToken } from "@/domain/public-home-share";
import { useI18n } from "@/hooks/use-i18n";
import { PublicHomeShareRepository } from "@/infrastructure/public-home-share-repository";

export function PublicHomeSharePage() {
  const { t } = useI18n();
  const repository = useMemo(() => new PublicHomeShareRepository(), []);
  const [documentValue, setDocumentValue] = useState<PublicHomeDocumentV1 | null>(null);
  const [status, setStatus] = useState<ReadOnlyHomeRendererStatus>("loading");

  useEffect(() => {
    let requestId = 0;
    let disposed = false;

    function loadCurrentShare() {
      requestId += 1;
      const activeRequestId = requestId;
      const token = readTokenFromFragment();

      setDocumentValue(null);
      if (!token) {
        setStatus("invalid");
        return;
      }

      setStatus("loading");
      void repository.read(token).then(
        (result) => {
          if (disposed || activeRequestId !== requestId) {
            return;
          }

          if (!result) {
            setStatus("invalid");
            return;
          }

          setDocumentValue(result.document);
          setStatus("ready");
        },
        () => {
          if (!disposed && activeRequestId === requestId) {
            setStatus("invalid");
          }
        }
      );
    }

    loadCurrentShare();
    window.addEventListener("hashchange", loadCurrentShare);

    return () => {
      disposed = true;
      requestId += 1;
      window.removeEventListener("hashchange", loadCurrentShare);
    };
  }, [repository]);

  return (
    <div className="public-share-page-shell">
      <ReadOnlyHomeRendererBoundary unavailableLabel={t("settings.publicShare.pageUnavailable")}>
        <ReadOnlyHomeRenderer
          document={documentValue}
          status={status}
          copy={{
            emptyLabel: status === "loading"
              ? t("settings.publicShare.pageLoading")
              : t("settings.publicShare.pageUnavailable"),
            unavailableLabel: t("settings.publicShare.pageUnavailable")
          }}
        />
      </ReadOnlyHomeRendererBoundary>
      {status === "invalid" ? (
        <p className="public-share-page-help">{t("settings.publicShare.pageUnavailableHelp")}</p>
      ) : null}
    </div>
  );
}

function readTokenFromFragment(): string | null {
  const fragment = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : "";

  return isPublicHomeShareToken(fragment) ? fragment : null;
}
