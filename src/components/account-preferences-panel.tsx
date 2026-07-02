"use client";

import { useMemo, useState } from "react";
import {
  DENSITY_OPTIONS,
  FONT_FAMILY_OPTIONS,
  type DensityPreference,
  type FontFamilyPreference,
  type LocalePreference,
  LOCALE_OPTIONS,
  normalizeUiPreferences,
  SEARCH_ENGINE_OPTIONS,
  type SearchEnginePreference,
  type ThemePreference,
  THEME_OPTIONS,
  type UiPreferences
} from "@/domain/ui-preferences";
import { StatusMessage } from "@/components/status-message";
import type { I18nMessageKey, I18nTranslate } from "@/i18n/messages";
import { useI18n } from "@/hooks/use-i18n";
import { useUiPreferences } from "@/hooks/use-ui-preferences";
import type { AccountDataState } from "@/hooks/use-account-data";
import { trackProductEvent } from "@/infrastructure/product-analytics-repository";

interface AccountPreferencesPanelProps {
  accountData: AccountDataState;
  authLoading: boolean;
  embedded?: boolean;
  signedIn: boolean;
}

export function AccountPreferencesPanel({ accountData, authLoading, embedded = false, signedIn }: AccountPreferencesPanelProps) {
  const { t } = useI18n();
  const uiPreferences = useUiPreferences();
  const accountPreferencesReady = Boolean(signedIn && accountData.preferences && !accountData.error);
  const usesAccountPreferences = accountPreferencesReady;
  const basePreferences = useMemo(() => {
    if (accountPreferencesReady && accountData.preferences) {
      return normalizeUiPreferences({
        locale: accountData.preferences.locale,
        themePreference: accountData.preferences.themePreference,
        fontFamily: accountData.preferences.fontFamily,
        density: accountData.preferences.density,
        defaultSearchEngine: accountData.preferences.defaultSearchEngine
      });
    }

    return uiPreferences.preferences;
  }, [accountData.preferences, accountPreferencesReady, uiPreferences.preferences]);
  const defaultSpaceName = useMemo(() => {
    const defaultSpaceId = accountData.preferences?.defaultSpaceId;
    if (!defaultSpaceId) {
      return t("preferences.defaultHomeSpaceUnset");
    }

    return accountData.homeSpaces.find((homeSpace) => homeSpace.id === defaultSpaceId)?.name ?? defaultSpaceId;
  }, [accountData.homeSpaces, accountData.preferences?.defaultSpaceId, t]);
  const formDisabled = authLoading || accountData.loading;

  const content = (
    <>
      {authLoading ? (
        <div className="settings-placeholder">
          <strong>{t("preferences.accountLoadingTitle")}</strong>
          <p>{t("preferences.accountLoadingDescription")}</p>
        </div>
      ) : (
        <>
          {signedIn && accountData.error ? (
            <div className="settings-placeholder">
              <strong>{t("preferences.accountLoadFailedTitle")}</strong>
              <StatusMessage role="alert" tone="danger">{accountData.error}</StatusMessage>
              <p>{t("preferences.accountLoadFailedDescription")}</p>
            </div>
          ) : null}

          <PreferencesEditor
            key={preferencesKey(basePreferences)}
            accountData={accountData}
            basePreferences={basePreferences}
            defaultSpaceName={defaultSpaceName}
            formDisabled={formDisabled}
            usesAccountPreferences={usesAccountPreferences}
          />
        </>
      )}
    </>
  );

  if (embedded) {
    return <div className="account-preferences-panel-content">{content}</div>;
  }

  return (
    <section className="settings-panel" aria-label={t("preferences.title")}>
      <div className="panel-header">
        <h2>{t("preferences.title")}</h2>
        <span>{signedIn ? t("preferences.accountBadge") : t("preferences.localBadge")}</span>
      </div>
      {content}
    </section>
  );
}

interface PreferencesEditorProps {
  accountData: AccountDataState;
  basePreferences: UiPreferences;
  defaultSpaceName: string;
  formDisabled: boolean;
  usesAccountPreferences: boolean;
}

function PreferencesEditor({
  accountData,
  basePreferences,
  defaultSpaceName,
  formDisabled,
  usesAccountPreferences
}: PreferencesEditorProps) {
  const { t, locale } = useI18n();
  const uiPreferences = useUiPreferences();
  const [formValues, setFormValues] = useState<UiPreferences>(basePreferences);
  const [localMessage, setLocalMessage] = useState("");
  const saving = accountData.updatingPreferences;
  const controlsDisabled = formDisabled || saving;
  const formChanged = !preferencesEqual(formValues, basePreferences);
  const accountPreferencesMessage = accountData.preferencesMessage ? t("preferences.accountSaved") : "";
  const statusMessage = accountData.preferencesError
    || localMessage
    || accountPreferencesMessage
    || uiPreferences.error
    || t(usesAccountPreferences ? "preferences.scopeAccount" : "preferences.scopeLocal");
  const hasStatusError = Boolean(accountData.preferencesError || uiPreferences.error);
  const statusTone = hasStatusError ? "danger" : localMessage || accountPreferencesMessage ? "success" : "neutral";
  const saveDisabledReason = getPreferencesSaveDisabledReason(controlsDisabled, formChanged, saving, formDisabled);
  const saveDisabledTitle = saveDisabledReason ? t(saveDisabledReason) : undefined;

  async function savePreferences() {
    const normalized = normalizeUiPreferences(formValues);
    setLocalMessage("");

    if (usesAccountPreferences) {
      const updated = await accountData.updatePreferences(normalized);
      if (updated) {
        uiPreferences.applyAccountPreferences(updated);
        setLocalMessage(t("preferences.accountSaved"));
        trackProductEvent("account.preferences_updated", {
          result: "account"
        });
      }
      return;
    }

    uiPreferences.updateLocalPreferences(normalized);
    setLocalMessage(t("preferences.localSaved"));
    trackProductEvent("account.preferences_updated", {
      result: "local"
    });
  }

  return (
    <>
      <div className="preference-form-grid">
        <label className="field">
          <span>{t("preferences.language")}</span>
          <select
            value={formValues.locale}
            disabled={controlsDisabled}
            onChange={(event) => setFormValues((current) => normalizeUiPreferences({ ...current, locale: event.target.value }))}
          >
            {LOCALE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{getLocaleOptionLabel(option.value, t)}</option>)}
          </select>
          {formValues.locale === "system" ? (
            <small>{t("preferences.languageResolved", { locale: getLocaleOptionLabel(locale, t) })}</small>
          ) : null}
        </label>

        <label className="field">
          <span>{t("preferences.themePreference")}</span>
          <select
            value={formValues.themePreference}
            disabled={controlsDisabled}
            onChange={(event) => setFormValues((current) => normalizeUiPreferences({ ...current, themePreference: event.target.value }))}
          >
            {THEME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{getThemeOptionLabel(option.value, t)}</option>)}
          </select>
        </label>

        <label className="field">
          <span>{t("preferences.fontFamily")}</span>
          <select
            value={formValues.fontFamily}
            disabled={controlsDisabled}
            onChange={(event) => setFormValues((current) => normalizeUiPreferences({ ...current, fontFamily: event.target.value }))}
          >
            {FONT_FAMILY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{getFontOptionLabel(option.value, t)}</option>)}
          </select>
        </label>

        <label className="field">
          <span>{t("preferences.density")}</span>
          <select
            value={formValues.density}
            disabled={controlsDisabled}
            onChange={(event) => setFormValues((current) => normalizeUiPreferences({ ...current, density: event.target.value }))}
          >
            {DENSITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{getDensityOptionLabel(option.value, t)}</option>)}
          </select>
        </label>

        <label className="field">
          <span>{t("preferences.defaultSearchEngine")}</span>
          <select
            value={formValues.defaultSearchEngine}
            disabled={controlsDisabled}
            onChange={(event) => setFormValues((current) => normalizeUiPreferences({ ...current, defaultSearchEngine: event.target.value }))}
          >
            {SEARCH_ENGINE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <div className="preference-readonly-row">
          <span>{t("preferences.defaultHomeSpace")}</span>
          <strong>{defaultSpaceName}</strong>
        </div>
      </div>

      <div className="settings-actions">
        <button
          className="utility-button"
          type="button"
          disabled={controlsDisabled || !formChanged}
          title={saveDisabledTitle}
          onClick={savePreferences}
        >
          {saving ? t("preferences.saving") : t("preferences.save")}
        </button>
      </div>

      <StatusMessage role={hasStatusError ? "alert" : "status"} tone={statusTone}>
        {statusMessage}
      </StatusMessage>
    </>
  );
}

function preferencesEqual(left: UiPreferences, right: UiPreferences): boolean {
  return left.locale === right.locale
    && left.themePreference === right.themePreference
    && left.fontFamily === right.fontFamily
    && left.density === right.density
    && left.defaultSearchEngine === right.defaultSearchEngine;
}

function preferencesKey(preferences: UiPreferences): string {
  return [
    preferences.locale,
    preferences.themePreference,
    preferences.fontFamily,
    preferences.density,
    preferences.defaultSearchEngine
  ].join(":");
}

function getPreferencesSaveDisabledReason(
  controlsDisabled: boolean,
  formChanged: boolean,
  saving: boolean,
  formDisabled: boolean
): I18nMessageKey | undefined {
  if (saving) {
    return "preferences.savePendingTitle";
  }

  if (formDisabled) {
    return "preferences.loadingTitle";
  }

  if (controlsDisabled) {
    return "preferences.saveUnavailableTitle";
  }

  if (!formChanged) {
    return "preferences.unchangedTitle";
  }

  return "preferences.saveTitle";
}

function getLocaleOptionLabel(locale: LocalePreference, t: I18nTranslate): string {
  switch (locale) {
    case "system":
      return t("preferences.option.system");
    case "zh-CN":
      return t("preferences.option.zhCN");
    case "zh-TW":
      return t("preferences.option.zhTW");
    case "en-US":
      return t("preferences.option.enUS");
    case "fr-FR":
      return t("preferences.option.frFR");
    case "es-ES":
      return t("preferences.option.esES");
    case "ja-JP":
      return t("preferences.option.jaJP");
    case "ko-KR":
      return t("preferences.option.koKR");
    case "it-IT":
      return t("preferences.option.itIT");
    default:
      return locale;
  }
}

function getThemeOptionLabel(theme: ThemePreference, t: I18nTranslate): string {
  switch (theme) {
    case "system":
      return t("preferences.theme.system");
    case "light":
      return t("preferences.theme.light");
    case "dark":
      return t("preferences.theme.dark");
  }
}

function getFontOptionLabel(font: FontFamilyPreference, t: I18nTranslate): string {
  switch (font) {
    case "system":
      return t("preferences.font.system");
    case "serif":
      return t("preferences.font.serif");
    case "mono":
      return t("preferences.font.mono");
  }
}

function getDensityOptionLabel(density: DensityPreference, t: I18nTranslate): string {
  switch (density) {
    case "comfortable":
      return t("preferences.density.comfortable");
    case "compact":
      return t("preferences.density.compact");
  }
}

export function formatPreferenceLocaleLabel(locale: LocalePreference, t: I18nTranslate): string {
  return getLocaleOptionLabel(locale, t);
}

export function formatPreferenceSearchEngineLabel(searchEngine: SearchEnginePreference): string {
  return SEARCH_ENGINE_OPTIONS.find((option) => option.value === searchEngine)?.label ?? searchEngine;
}
