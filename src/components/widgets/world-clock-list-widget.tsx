"use client";

import { useEffect, useMemo, useState } from "react";
import { type HomeWidget } from "@/domain/home-document";
import {
  getWorldClockFallbackLabel,
  readWorldClockItems,
  type WorldClockItem
} from "@/domain/world-clock-widget";
import { useI18n } from "@/hooks/use-i18n";

interface WorldClockListWidgetProps {
  widget: HomeWidget;
}

export function WorldClockListWidget({ widget }: WorldClockListWidgetProps) {
  const { locale, t } = useI18n();
  const clocks = useMemo(() => readWorldClockItems(widget.config), [widget.config]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (clocks.length === 0) {
    return (
      <div className="world-clock-widget is-empty">
        <p className="world-clock-empty-title">{t("worldClock.emptyTitle")}</p>
        <p className="world-clock-empty-copy">{t("worldClock.emptyCopy")}</p>
      </div>
    );
  }

  return (
    <div className="world-clock-widget">
      <ul className="world-clock-list">
        {clocks.map((clock) => (
          <WorldClockCard
            key={clock.id}
            clock={clock}
            locale={locale}
            now={now}
          />
        ))}
      </ul>
    </div>
  );
}

function WorldClockCard({
  clock,
  locale,
  now
}: {
  clock: WorldClockItem;
  locale: string;
  now: Date;
}) {
  const { t } = useI18n();
  const label = clock.label || getWorldClockFallbackLabel(clock.timeZone);
  const timeLabel = formatWorldClockTime(now, clock.timeZone, locale);
  const dateLabel = formatWorldClockDate(now, clock.timeZone, locale);
  const offsetLabel = formatWorldClockOffset(now, clock.timeZone, t);

  return (
    <li className="world-clock-item">
      <div className="world-clock-item-head">
        <strong>{label}</strong>
        <span>{clock.timeZone}</span>
      </div>
      <div className="world-clock-time">{timeLabel}</div>
      <div className="world-clock-meta">
        <span>{dateLabel}</span>
        <span>{offsetLabel}</span>
      </div>
    </li>
  );
}

function formatWorldClockTime(now: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit"
  }).format(now);
}

function formatWorldClockDate(now: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(now);
}

function formatWorldClockOffset(now: Date, timeZone: string, t: ReturnType<typeof useI18n>["t"]): string {
  const localKey = formatDateKey(now, undefined);
  const targetKey = formatDateKey(now, timeZone);

  if (targetKey === localKey) {
    return t("worldClock.offsetToday");
  }

  const localDate = parseDateKey(localKey);
  const targetDate = parseDateKey(targetKey);
  const dayMs = 24 * 60 * 60 * 1000;
  const offset = Math.round((targetDate.getTime() - localDate.getTime()) / dayMs);

  if (offset === 1) {
    return t("worldClock.offsetTomorrow");
  }

  if (offset === -1) {
    return t("worldClock.offsetYesterday");
  }

  return offset > 0
    ? t("worldClock.offsetAhead", { count: offset })
    : t("worldClock.offsetBehind", { count: Math.abs(offset) });
}

function formatDateKey(now: Date, timeZone: string | undefined): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
