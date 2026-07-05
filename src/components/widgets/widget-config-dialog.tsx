"use client";

import { type FormEvent, useMemo, useState } from "react";
import { normalizeCalendarConfig, type WeekStart } from "@/domain/calendar-widget";
import {
  COUNTDOWN_WIDGET_TITLE_MAX_LENGTH,
  normalizeCountdownConfig,
  normalizeCountdownDisplayMode,
  normalizeCountdownTitle,
  normalizeTargetDate,
  type CountdownDisplayMode
} from "@/domain/countdown-widget";
import { normalizeText, type HomeWidget } from "@/domain/home-document";
import { getNotesStats, readNoteItems } from "@/domain/notes-widget";
import { getTodoStats, readTodoItems } from "@/domain/todo-widget";
import { getWidgetDefinition } from "@/domain/widget-registry";
import { useI18n } from "@/hooks/use-i18n";
import {
  formatHomeWidgetDefaultTitle,
  formatHomeWidgetDescription,
  formatHomeWidgetSettingsDescription,
  formatHomeWidgetSettingsTitle,
  formatHomeWidgetTitle
} from "@/i18n/home-presentation";

interface WidgetConfigDialogProps {
  widget: HomeWidget;
  onCancel: () => void;
  onSave: (widget: HomeWidget) => void;
}

export function WidgetConfigDialog({ widget, onCancel, onSave }: WidgetConfigDialogProps) {
  const { t, format } = useI18n();
  const definition = getWidgetDefinition(widget.type);
  const dialogTitle = definition.settings ? formatHomeWidgetSettingsTitle(widget.type, t) : t("widgetConfig.fallbackTitle");
  const dialogDescription = definition.settings
    ? formatHomeWidgetSettingsDescription(widget.type, t)
    : formatHomeWidgetDescription(widget.type, t);
  const [titleDraft, setTitleDraft] = useState(widget.title);
  const [weekStartsOn, setWeekStartsOn] = useState<WeekStart>(() => normalizeCalendarConfig(widget.config).weekStartsOn);
  const [countdownEventTitle, setCountdownEventTitle] = useState(() => normalizeCountdownConfig(widget.config).eventTitle);
  const [countdownTargetDate, setCountdownTargetDate] = useState(() => normalizeCountdownConfig(widget.config).targetDate);
  const [countdownDisplayMode, setCountdownDisplayMode] = useState<CountdownDisplayMode>(() => normalizeCountdownConfig(widget.config).displayMode);
  const todoStats = useMemo(() => {
    if (widget.type !== "todo.list") {
      return null;
    }

    return getTodoStats(readTodoItems(widget.config));
  }, [widget.config, widget.type]);
  const notesStats = useMemo(() => {
    if (widget.type !== "notes.list") {
      return null;
    }

    return getNotesStats(readNoteItems(widget.config));
  }, [widget.config, widget.type]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = normalizeText(titleDraft) || formatHomeWidgetDefaultTitle(widget.type, t);
    const nextConfig = widget.type === "calendar.month"
      ? {
        ...widget.config,
        weekStartsOn
      }
      : widget.type === "countdown.timer"
        ? {
          ...widget.config,
          eventTitle: normalizeCountdownTitle(countdownEventTitle),
          targetDate: normalizeTargetDate(countdownTargetDate),
          displayMode: normalizeCountdownDisplayMode(countdownDisplayMode)
        }
        : widget.config;
    const nextWidget: HomeWidget = {
      ...widget,
      title,
      config: nextConfig
    };

    onSave(nextWidget);
  }

  return (
    <div className="settings-modal" role="presentation">
      <form
        className="settings-dialog widget-config-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="widget-config-title"
        onSubmit={handleSubmit}
      >
        <div className="settings-dialog-header">
          <div>
            <h2 id="widget-config-title">{dialogTitle}</h2>
            <p>{formatHomeWidgetTitle(widget.type, t)} · {dialogDescription}</p>
          </div>
          <button className="mini-button" type="button" aria-label={t("widgetConfig.closeAria")} title={t("common.close")} onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="settings-dialog-body">
          <label className="widget-config-field">
            <span>{t("widgetConfig.name")}</span>
            <input
              type="text"
              value={titleDraft}
              maxLength={48}
              onChange={(event) => setTitleDraft(event.target.value)}
            />
          </label>

          <div className="widget-config-readonly-grid" aria-label={t("widgetConfig.statusAria")}>
            <div>
              <span>{t("widgetConfig.type")}</span>
              <strong>{formatHomeWidgetTitle(widget.type, t)}</strong>
            </div>
            <div>
              <span>{t("widgetConfig.collapsed")}</span>
              <strong>{widget.layout.collapsed ? t("widgetConfig.yes") : t("widgetConfig.no")}</strong>
            </div>
          </div>

          {todoStats ? (
            <section className="widget-config-section" aria-label={t("widgetConfig.todoStatusAria")}>
              <h3>{t("widgetConfig.todoStatusTitle")}</h3>
              <div className="widget-config-readonly-grid">
                <div>
                  <span>{t("widgetConfig.active")}</span>
                  <strong>{format.number(todoStats.active)}</strong>
                </div>
                <div>
                  <span>{t("widgetConfig.completed")}</span>
                  <strong>{format.number(todoStats.completed)}</strong>
                </div>
                <div>
                  <span>{t("widgetConfig.total")}</span>
                  <strong>{format.number(todoStats.total)}</strong>
                </div>
              </div>
            </section>
          ) : null}

          {notesStats ? (
            <section className="widget-config-section" aria-label={t("widgetConfig.notesStatusAria")}>
              <h3>{t("widgetConfig.notesStatusTitle")}</h3>
              <div className="widget-config-readonly-grid">
                <div>
                  <span>{t("widgetConfig.total")}</span>
                  <strong>{format.number(notesStats.total)}</strong>
                </div>
              </div>
            </section>
          ) : null}

          {widget.type === "calendar.month" ? (
            <section className="widget-config-section" aria-label={t("widgetConfig.calendarSettingsAria")}>
              <h3>{t("widgetConfig.calendarSettingsTitle")}</h3>
              <div className="widget-config-option-row">
                <span>{t("widgetConfig.weekStart")}</span>
                <div className="widget-config-segmented" role="group" aria-label={t("widgetConfig.weekStart")}>
                  <button
                    type="button"
                    aria-pressed={weekStartsOn === 1}
                    onClick={() => setWeekStartsOn(1)}
                  >
                    {t("widgetConfig.weekStartMondayShort")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={weekStartsOn === 0}
                    onClick={() => setWeekStartsOn(0)}
                  >
                    {t("widgetConfig.weekStartSundayShort")}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {widget.type === "countdown.timer" ? (
            <section className="widget-config-section" aria-label={t("widgetConfig.countdownSettingsAria")}>
              <h3>{t("widgetConfig.countdownSettingsTitle")}</h3>
              <label className="widget-config-field">
                <span>{t("widgetConfig.countdownEventTitle")}</span>
                <input
                  type="text"
                  value={countdownEventTitle}
                  maxLength={COUNTDOWN_WIDGET_TITLE_MAX_LENGTH}
                  placeholder={t("widgetConfig.countdownEventPlaceholder")}
                  onChange={(event) => setCountdownEventTitle(event.target.value)}
                />
              </label>
              <label className="widget-config-field">
                <span>{t("widgetConfig.countdownTargetDate")}</span>
                <input
                  type="date"
                  value={countdownTargetDate}
                  onChange={(event) => setCountdownTargetDate(event.target.value)}
                />
              </label>
              <div className="widget-config-option-row">
                <span>{t("widgetConfig.countdownDisplayMode")}</span>
                <div className="widget-config-segmented" role="group" aria-label={t("widgetConfig.countdownDisplayMode")}>
                  <button
                    type="button"
                    aria-pressed={countdownDisplayMode === "days"}
                    onClick={() => setCountdownDisplayMode("days")}
                  >
                    {t("widgetConfig.countdownModeDays")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={countdownDisplayMode === "days-hours"}
                    onClick={() => setCountdownDisplayMode("days-hours")}
                  >
                    {t("widgetConfig.countdownModeDaysHours")}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <div className="settings-dialog-footer">
          <button className="utility-button" type="button" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button className="utility-button" type="submit">
            {t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
