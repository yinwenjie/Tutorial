"use client";

import { useEffect, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { useI18n } from "@/hooks/use-i18n";
import {
  ERROR_MONITORING_UPDATED_EVENT,
  loadErrorMonitoringPreferences,
  setErrorMonitoringEnabled
} from "@/infrastructure/error-monitoring-repository";
import {
  PRODUCT_ANALYTICS_UPDATED_EVENT,
  loadProductAnalyticsPreferences,
  setProductAnalyticsEnabled
} from "@/infrastructure/product-analytics-repository";

export function ProductAnalyticsSettingsPanel() {
  const { t } = useI18n();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [errorMonitoringEnabled, setErrorMonitoringEnabledState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function refresh() {
      const analyticsPreferences = loadProductAnalyticsPreferences();
      const errorMonitoringPreferences = loadErrorMonitoringPreferences();
      setAnalyticsEnabled(analyticsPreferences.enabled);
      setErrorMonitoringEnabledState(errorMonitoringPreferences.enabled);
      setReady(true);
    }

    refresh();
    window.addEventListener(PRODUCT_ANALYTICS_UPDATED_EVENT, refresh);
    window.addEventListener(ERROR_MONITORING_UPDATED_EVENT, refresh);

    return () => {
      window.removeEventListener(PRODUCT_ANALYTICS_UPDATED_EVENT, refresh);
      window.removeEventListener(ERROR_MONITORING_UPDATED_EVENT, refresh);
    };
  }, []);

  function handleAnalyticsToggle(nextEnabled: boolean) {
    const preferences = setProductAnalyticsEnabled(nextEnabled);
    setAnalyticsEnabled(preferences.enabled);
    setReady(true);
  }

  function handleErrorMonitoringToggle(nextEnabled: boolean) {
    const preferences = setErrorMonitoringEnabled(nextEnabled);
    setErrorMonitoringEnabledState(preferences.enabled);
    setReady(true);
  }

  return (
    <div className="advanced-operation-block">
      <div className="advanced-operation-head">
        <h3>{t("settings.analytics.title")}</h3>
        <span>{t("settings.analytics.kicker")}</span>
      </div>
      <label className="analytics-toggle-row">
        <input
          type="checkbox"
          checked={analyticsEnabled}
          disabled={!ready}
          onChange={(event) => handleAnalyticsToggle(event.target.checked)}
        />
        <span>{t("settings.analytics.allowEvents")}</span>
      </label>
      <label className="analytics-toggle-row">
        <input
          type="checkbox"
          checked={errorMonitoringEnabled}
          disabled={!ready}
          onChange={(event) => handleErrorMonitoringToggle(event.target.checked)}
        />
        <span>{t("settings.analytics.allowErrors")}</span>
      </label>
      <StatusMessage tone="neutral">
        {t("settings.analytics.description")}
      </StatusMessage>
    </div>
  );
}
