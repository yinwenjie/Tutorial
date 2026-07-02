import type { ResolvedLocale } from "@/domain/ui-preferences";

export type WeekStartValue = 0 | 1;

export interface I18nFormatters {
  dateTime: (value: Date | string | number) => string;
  shortDateTime: (value: Date | string | number) => string;
  weekdayMonthDay: (value: Date | string | number) => string;
  monthYear: (value: Date | string | number) => string;
  monthDay: (value: Date | string | number) => string;
  dayOfMonth: (value: Date | string | number) => string;
  weekdayLabels: (weekStartsOn: WeekStartValue) => string[];
  number: (value: number) => string;
}

export function createI18nFormatters(locale: ResolvedLocale): I18nFormatters {
  return {
    dateTime: (value) => formatDateTime(value, locale),
    shortDateTime: (value) => formatShortDateTime(value, locale),
    weekdayMonthDay: (value) => formatWeekdayMonthDay(value, locale),
    monthYear: (value) => formatMonthYear(value, locale),
    monthDay: (value) => formatMonthDay(value, locale),
    dayOfMonth: (value) => formatDayOfMonth(value, locale),
    weekdayLabels: (weekStartsOn) => formatWeekdayLabels(locale, weekStartsOn),
    number: (value) => formatNumber(value, locale)
  };
}

export function formatDateTime(value: Date | string | number, locale: ResolvedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(toDate(value));
}

export function formatShortDateTime(value: Date | string | number, locale: ResolvedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(toDate(value));
}

export function formatWeekdayMonthDay(value: Date | string | number, locale: ResolvedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(toDate(value));
}

export function formatMonthYear(value: Date | string | number, locale: ResolvedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric"
  }).format(toDate(value));
}

export function formatMonthDay(value: Date | string | number, locale: ResolvedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric"
  }).format(toDate(value));
}

export function formatDayOfMonth(value: Date | string | number, locale: ResolvedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric"
  }).format(toDate(value));
}

export function formatWeekdayLabels(locale: ResolvedLocale, weekStartsOn: WeekStartValue): string[] {
  const sunday = new Date(2026, 0, 4);
  const labels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + index);
    return new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(date);
  });

  return weekStartsOn === 1 ? [...labels.slice(1), labels[0]] : labels;
}

export function formatNumber(value: number, locale: ResolvedLocale): string {
  return new Intl.NumberFormat(locale).format(value);
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}
