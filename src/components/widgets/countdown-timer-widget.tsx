"use client";

import { useMemo } from "react";
import {
  getCountdownStatus,
  normalizeCountdownConfig,
  parseLocalDate,
  type CountdownStatus
} from "@/domain/countdown-widget";
import { type HomeWidget } from "@/domain/home-document";
import { useI18n } from "@/hooks/use-i18n";

interface CountdownTimerWidgetProps {
  widget: HomeWidget;
}

export function CountdownTimerWidget({ widget }: CountdownTimerWidgetProps) {
  const { t, format } = useI18n();
  const config = useMemo(() => normalizeCountdownConfig(widget.config), [widget.config]);
  const status = useMemo(() => getCountdownStatus(config), [config]);
  const targetDate = config.targetDate ? parseLocalDate(config.targetDate) : null;
  const eventTitle = config.eventTitle || t("countdown.defaultEventTitle");
  const primaryLabel = formatCountdownPrimary(status, config.displayMode, t, format);

  if (status.kind === "unconfigured") {
    return (
      <div className="countdown-widget is-empty">
        <p className="countdown-empty-title">{t("countdown.emptyTitle")}</p>
        <p className="countdown-empty-copy">{t("countdown.emptyCopy")}</p>
      </div>
    );
  }

  return (
    <div className={`countdown-widget is-${status.kind}`}>
      <div className="countdown-event">
        <span>{t("countdown.eventLabel")}</span>
        <strong>{eventTitle}</strong>
      </div>
      <div className="countdown-primary" aria-label={t("countdown.primaryAria")}>
        <strong>{primaryLabel}</strong>
        <span>{formatCountdownSecondary(status, t)}</span>
      </div>
      <div className="countdown-meta">
        <span>{t("countdown.targetDate", { date: targetDate ? format.weekdayMonthDay(targetDate) : config.targetDate })}</span>
        <span>{t(config.displayMode === "days-hours" ? "countdown.modeDaysHours" : "countdown.modeDays")}</span>
      </div>
    </div>
  );
}

export function formatCountdownPrimary(
  status: CountdownStatus,
  displayMode: "days" | "days-hours",
  t: ReturnType<typeof useI18n>["t"],
  format: ReturnType<typeof useI18n>["format"]
): string {
  if (status.kind === "unconfigured") {
    return t("countdown.summaryUnconfigured");
  }

  if (status.kind === "today") {
    return t("countdown.today");
  }

  if (status.kind === "past") {
    return t("countdown.daysAgo", { count: format.number(status.days) });
  }

  if (displayMode === "days-hours" && status.durationDays > 0 && status.hours > 0) {
    return t("countdown.daysHoursLeft", {
      days: format.number(status.durationDays),
      hours: format.number(status.hours)
    });
  }

  if (displayMode === "days-hours" && status.durationDays === 0 && status.hours > 0) {
    return t("countdown.hoursLeft", { count: format.number(status.hours) });
  }

  if (displayMode === "days-hours" && status.durationDays > 0) {
    return t("countdown.daysLeft", { count: format.number(status.durationDays) });
  }

  return t("countdown.daysLeft", { count: format.number(status.days) });
}

function formatCountdownSecondary(status: CountdownStatus, t: ReturnType<typeof useI18n>["t"]): string {
  switch (status.kind) {
    case "future":
      return t("countdown.statusFuture");
    case "today":
      return t("countdown.statusToday");
    case "past":
      return t("countdown.statusPast");
    case "unconfigured":
      return t("countdown.statusUnconfigured");
  }
}
