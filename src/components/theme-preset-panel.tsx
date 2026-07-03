"use client";

import type { CSSProperties } from "react";
import { StatusMessage } from "@/components/status-message";
import type { HomeDocumentV2 } from "@/domain/home-document";
import {
  getHomeThemePreset,
  normalizeHomeThemePresetId,
  VISIBLE_HOME_THEME_PRESETS,
  type HomeThemePreset
} from "@/domain/theme-preset";
import { useI18n } from "@/hooks/use-i18n";
import { trackProductEvent } from "@/infrastructure/product-analytics-repository";
import {
  formatSettingsThemePresetDescription,
  formatSettingsThemePresetName
} from "@/i18n/settings-presentation";

interface ThemePresetPanelProps {
  documentValue: HomeDocumentV2;
  embedded?: boolean;
  storageReady: boolean;
  onCommitDocument: (documentValue: HomeDocumentV2, message?: string) => void;
}

export function ThemePresetPanel({
  documentValue,
  embedded = false,
  storageReady,
  onCommitDocument
}: ThemePresetPanelProps) {
  const { t } = useI18n();
  const activePresetId = normalizeHomeThemePresetId(documentValue.theme.presetId, documentValue.theme.accent);
  const activePreset = getHomeThemePreset(activePresetId);
  const visiblePresets = activePreset.family === "v2"
    ? VISIBLE_HOME_THEME_PRESETS
    : [activePreset, ...VISIBLE_HOME_THEME_PRESETS];
  const disabledReason = storageReady ? undefined : t("settings.common.storageNotReady");

  function applyPreset(preset: HomeThemePreset) {
    if (preset.id === activePresetId || !storageReady) {
      return;
    }

    onCommitDocument({
      ...documentValue,
      theme: {
        ...documentValue.theme,
        presetId: preset.id,
        accent: preset.accent
      }
    }, t("settings.theme.switched", { theme: formatSettingsThemePresetName(preset.id, t) }));
    trackProductEvent("theme.changed", {
      source: "settings",
      themePresetId: preset.id
    });
  }

  const content = (
    <>
      <div className="theme-preset-grid">
        {visiblePresets.map((preset) => (
          <ThemePresetButton
            key={preset.id}
            disabled={!storageReady}
            disabledReason={disabledReason}
            preset={preset}
            selected={preset.id === activePresetId}
            t={t}
            onApply={applyPreset}
          />
        ))}
      </div>

      <StatusMessage tone="neutral">
        {t("settings.theme.current", { theme: formatSettingsThemePresetName(activePreset.id, t) })}
      </StatusMessage>
    </>
  );

  if (embedded) {
    return <div className="theme-preset-panel-content">{content}</div>;
  }

  return (
    <section className="settings-panel" aria-label={t("settings.section.themeStyle.title")}>
      <div className="panel-header">
        <h2>{t("settings.section.themeStyle.title")}</h2>
        <span>{t("settings.section.themeStyle.kicker")}</span>
      </div>
      {content}
    </section>
  );
}

function ThemePresetButton({
  disabled,
  disabledReason,
  preset,
  selected,
  t,
  onApply
}: {
  disabled: boolean;
  disabledReason?: string;
  preset: HomeThemePreset;
  selected: boolean;
  t: ReturnType<typeof useI18n>["t"];
  onApply: (preset: HomeThemePreset) => void;
}) {
  const style = {
    "--theme-preview-bg": preset.preview.bg,
    "--theme-preview-surface": preset.preview.surface,
    "--theme-preview-accent": preset.preview.accent,
    "--theme-preview-radius": preset.preview.radius
  } as CSSProperties;

  return (
    <button
      className={`theme-preset-card${selected ? " is-selected" : ""}`}
      type="button"
      style={style}
      aria-pressed={selected}
      disabled={disabled}
      title={disabled ? disabledReason : t("settings.theme.switchTitle", { theme: formatSettingsThemePresetName(preset.id, t) })}
      onClick={() => onApply(preset)}
    >
      <span className="theme-preset-preview" aria-hidden="true">
        <span />
        <span />
      </span>
      <span className="theme-preset-copy">
        <strong>{formatSettingsThemePresetName(preset.id, t)}</strong>
        <span>{formatSettingsThemePresetDescription(preset.id, t)}</span>
      </span>
      <span className="theme-preset-family">{preset.family === "legacy" ? t("settings.theme.familyLegacy") : t("settings.theme.familyV2")}</span>
      <span className="theme-preset-state">{selected ? t("settings.theme.selected") : t("settings.theme.apply")}</span>
    </button>
  );
}
