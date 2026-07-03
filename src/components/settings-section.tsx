"use client";

import type { ReactNode } from "react";
import type { StatusTone } from "@/components/status-message";
import type { SettingsSectionId } from "@/domain/settings-layout";
import { useI18n } from "@/hooks/use-i18n";

interface SettingsSectionProps {
  children: ReactNode;
  expanded: boolean;
  id: SettingsSectionId;
  kicker: string;
  summary: string;
  summarySlot?: ReactNode;
  title: string;
  tone?: StatusTone;
  onToggle: () => void;
}

export function SettingsSection({
  children,
  expanded,
  id,
  kicker,
  summary,
  summarySlot,
  title,
  tone = "neutral",
  onToggle
}: SettingsSectionProps) {
  const { t } = useI18n();
  const titleId = `settings-section-${id}-title`;
  const bodyId = `settings-section-${id}-body`;

  return (
    <section className={`settings-section settings-section-${tone}${expanded ? " is-expanded" : ""}`} aria-labelledby={titleId}>
      <div className="settings-section-head">
        <button
          className="settings-section-toggle"
          type="button"
          aria-controls={bodyId}
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <span className="settings-section-copy">
            <span className="settings-section-kicker">{kicker}</span>
            <strong id={titleId}>{title}</strong>
            <span className="settings-section-summary">{summary}</span>
          </span>
          <span className="settings-section-action" aria-hidden="true">
            {expanded ? t("settings.section.collapse") : t("settings.section.expand")}
          </span>
        </button>
        {summarySlot ? <div className="settings-section-summary-slot">{summarySlot}</div> : null}
      </div>

      <div className="settings-section-body" hidden={!expanded} id={bodyId}>
        {children}
      </div>
    </section>
  );
}
