"use client";

import { useMemo, useState } from "react";
import { type HomeWidget } from "@/domain/home-document";
import {
  addMonths,
  buildCalendarMonth,
  getMonthLabel,
  isSameMonth,
  normalizeCalendarConfig,
  startOfMonth
} from "@/domain/calendar-widget";
import { useI18n } from "@/hooks/use-i18n";

interface CalendarMonthWidgetProps {
  widget: HomeWidget;
}

export function CalendarMonthWidget({ widget }: CalendarMonthWidgetProps) {
  const { locale, t, format } = useI18n();
  const config = useMemo(() => normalizeCalendarConfig(widget.config), [widget.config]);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const today = new Date();
  const todayMonth = startOfMonth(today);
  const calendar = useMemo(() => buildCalendarMonth(visibleMonth, config.weekStartsOn, locale), [config.weekStartsOn, locale, visibleMonth]);
  const viewingCurrentMonth = isSameMonth(visibleMonth, todayMonth);
  const previousMonthLabel = getMonthLabel(addMonths(visibleMonth, -1), locale);
  const nextMonthLabel = getMonthLabel(addMonths(visibleMonth, 1), locale);
  const todayLabel = format.monthDay(today);
  const weekStartLabel = t(config.weekStartsOn === 1 ? "calendar.weekStartMonday" : "calendar.weekStartSunday");

  return (
    <div className="calendar-widget">
      <div className="calendar-header">
        <button
          className="calendar-nav-button"
          type="button"
          aria-label={t("calendar.previousMonthAria", { month: previousMonthLabel })}
          title={t("calendar.previousMonthTitle")}
          onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
        >
          ‹
        </button>
        <div className="calendar-month-heading">
          <strong>{calendar.label}</strong>
          <span>{t(viewingCurrentMonth ? "calendar.todayCurrent" : "calendar.todayReference", { date: todayLabel })}</span>
        </div>
        <button
          className="calendar-nav-button"
          type="button"
          aria-label={t("calendar.nextMonthAria", { month: nextMonthLabel })}
          title={t("calendar.nextMonthTitle")}
          onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
        >
          ›
        </button>
      </div>

      <div className="calendar-control-row">
        <button
          className={["calendar-today-button", viewingCurrentMonth ? "is-current" : ""].filter(Boolean).join(" ")}
          type="button"
          disabled={viewingCurrentMonth}
          title={t(viewingCurrentMonth ? "calendar.todayButtonCurrentTitle" : "calendar.todayButtonTitle")}
          onClick={() => setVisibleMonth(todayMonth)}
        >
          {t("calendar.todayButton")}
        </button>
        <span className="calendar-config-summary">
          {weekStartLabel}
        </span>
      </div>

      <div className="calendar-grid" aria-label={t("calendar.ariaLabel", { month: calendar.label })}>
        {calendar.weekLabels.map((label, index) => (
          <span className="calendar-weekday" key={`weekday-${index}`}>{label}</span>
        ))}
        {calendar.days.map((day) => (
          <time
            className={[
              "calendar-day",
              day.inCurrentMonth ? "" : "is-muted",
              day.isToday ? "is-today" : "",
              day.isWeekend ? "is-weekend" : ""
            ].filter(Boolean).join(" ")}
            key={day.key}
            dateTime={day.key}
            aria-current={day.isToday ? "date" : undefined}
            title={t(day.isToday ? "calendar.todayDayTitle" : "calendar.dayTitle", { date: day.key })}
          >
            {day.day}
          </time>
        ))}
      </div>
    </div>
  );
}
