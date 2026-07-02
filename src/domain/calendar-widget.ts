import { DEFAULT_RESOLVED_LOCALE, type ResolvedLocale } from "@/domain/ui-preferences";
import { formatMonthYear, formatWeekdayLabels } from "@/i18n/formatters";

export type WeekStart = 0 | 1;

export interface CalendarMonthConfig extends Record<string, unknown> {
  weekStartsOn: WeekStart;
}

export interface CalendarDayCell {
  date: Date;
  day: number;
  key: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number;
  label: string;
  weekLabels: string[];
  days: CalendarDayCell[];
}

export function normalizeCalendarConfig(input: unknown): CalendarMonthConfig {
  const weekStartsOn = isRecord(input) && Number(input.weekStartsOn) === 0 ? 0 : 1;
  return { weekStartsOn };
}

export function buildCalendarMonth(
  anchorDate: Date,
  weekStartsOn: WeekStart,
  locale: ResolvedLocale = DEFAULT_RESOLVED_LOCALE
): CalendarMonth {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() - weekStartsOn + 7) % 7;
  const gridStart = new Date(year, month, 1 - offset);
  const today = startOfLocalDay(new Date());
  const days = Array.from({ length: 42 }, (_, dayIndex) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + dayIndex);

    return {
      date,
      day: date.getDate(),
      key: toLocalDateKey(date),
      inCurrentMonth: date.getMonth() === month,
      isToday: isSameLocalDate(date, today),
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    };
  });

  return {
    year,
    month,
    label: getMonthLabel(anchorDate, locale),
    weekLabels: formatWeekdayLabels(locale, weekStartsOn),
    days
  };
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getMonthLabel(date: Date, locale: ResolvedLocale = DEFAULT_RESOLVED_LOCALE): string {
  return formatMonthYear(date, locale);
}

export function isSameMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export function isSameLocalDate(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
