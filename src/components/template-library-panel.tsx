"use client";

import {
  HOME_TEMPLATES,
  type HomeTemplate,
  type HomeTemplateId,
  summarizeHomeTemplate
} from "@/domain/home-template";
import { useI18n } from "@/hooks/use-i18n";
import {
  formatHomeTemplateName,
  formatHomeTemplateSummary,
  formatHomeWidgetPresetTitle
} from "@/i18n/home-presentation";

interface TemplateLibraryPanelProps {
  actionLabel?: string;
  className?: string;
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
  selectedTemplateId?: HomeTemplateId;
  title?: string;
  onApply: (template: HomeTemplate) => void;
}

export function TemplateLibraryPanel({
  actionLabel,
  className = "",
  description,
  disabled = false,
  disabledReason,
  selectedTemplateId,
  title,
  onApply
}: TemplateLibraryPanelProps) {
  const { t } = useI18n();
  const resolvedTitle = title ?? t("template.libraryTitle");
  const resolvedDescription = description ?? t("template.libraryDescription");
  const resolvedActionLabel = actionLabel ?? t("home.templateAction");

  return (
    <section className={`template-library ${className}`.trim()} aria-label={resolvedTitle}>
      <div className="template-library-header">
        <div>
          <h2>{resolvedTitle}</h2>
          <p>{resolvedDescription}</p>
        </div>
      </div>

      <div className="template-grid">
        {HOME_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            actionLabel={resolvedActionLabel}
            disabled={disabled}
            disabledReason={disabledReason}
            selected={selectedTemplateId === template.id}
            template={template}
            onApply={onApply}
          />
        ))}
      </div>
    </section>
  );
}

function TemplateCard({
  actionLabel,
  disabled,
  disabledReason,
  selected,
  template,
  onApply
}: {
  actionLabel: string;
  disabled: boolean;
  disabledReason?: string;
  selected: boolean;
  template: HomeTemplate;
  onApply: (template: HomeTemplate) => void;
}) {
  const { t, format } = useI18n();
  const summary = summarizeHomeTemplate(template);
  const templateName = formatHomeTemplateName(template.id, t);
  const metricText = t("template.metricSummary", {
    groups: format.number(summary.groupCount),
    sites: format.number(summary.siteCount),
    widgets: format.number(summary.widgetCount)
  });
  const sampleText = summary.sampleSites.length > 0 ? summary.sampleSites.join(" / ") : t("template.noPresetSites");
  const widgetNames = template.widgets.map((preset) => formatHomeWidgetPresetTitle(preset, t));
  const widgetText = widgetNames.length > 0
    ? t("template.widgetSummary", { widgets: widgetNames.join(" / ") })
    : t("template.noPresetWidgets");

  return (
    <article className={`template-card${selected ? " is-selected" : ""}`}>
      <div className="template-card-main">
        <div className="template-card-title-row">
          <span className="template-accent" style={{ backgroundColor: template.accent }} aria-hidden="true" />
          <h3>{templateName}</h3>
        </div>
        <p>{formatHomeTemplateSummary(template.id, t)}</p>
      </div>
      <div className="template-card-meta">
        <span>{metricText}</span>
        <span>{sampleText}</span>
        <span>{widgetText}</span>
      </div>
      <button
        className="utility-button"
        type="button"
        disabled={disabled}
        title={disabled ? disabledReason : t("template.createTitle", { template: templateName })}
        onClick={() => onApply(template)}
      >
        {selected ? t("template.selected") : actionLabel}
      </button>
    </article>
  );
}
