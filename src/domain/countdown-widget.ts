export const COUNTDOWN_WIDGET_TITLE_MAX_LENGTH = 80;

export type CountdownDisplayMode = "days" | "days-hours";
export type CountdownStatusKind = "unconfigured" | "future" | "today" | "past";

export interface CountdownWidgetConfig extends Record<string, unknown> {
  eventTitle: string;
  targetDate: string;
  displayMode: CountdownDisplayMode;
}

export interface CountdownStatus {
  kind: CountdownStatusKind;
  targetDate: string;
  days: number;
  durationDays: number;
  hours: number;
}

export function normalizeCountdownConfig(input: unknown): CountdownWidgetConfig {
  const record = isRecord(input) ? input : {};
  const eventTitle = normalizeCountdownTitle(record.eventTitle);
  const targetDate = normalizeTargetDate(record.targetDate);
  const displayMode = normalizeCountdownDisplayMode(record.displayMode);

  return {
    eventTitle,
    targetDate,
    displayMode
  };
}

export function normalizeCountdownTitle(value: unknown): string {
  return readString(value).replace(/\s+/g, " ").slice(0, COUNTDOWN_WIDGET_TITLE_MAX_LENGTH);
}

export function normalizeTargetDate(value: unknown): string {
  const text = readString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "";
  }

  const date = parseLocalDate(text);
  if (!date || formatLocalDate(date) !== text) {
    return "";
  }

  return text;
}

export function normalizeCountdownDisplayMode(value: unknown): CountdownDisplayMode {
  return value === "days-hours" ? "days-hours" : "days";
}

export function getCountdownStatus(config: CountdownWidgetConfig, now = new Date()): CountdownStatus {
  const target = parseLocalDate(config.targetDate);
  if (!target) {
    return {
      kind: "unconfigured",
      targetDate: "",
      days: 0,
      durationDays: 0,
      hours: 0
    };
  }

  const today = startOfLocalDay(now);
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round((target.getTime() - today.getTime()) / dayMs);

  if (days === 0) {
    return {
      kind: "today",
      targetDate: config.targetDate,
      days: 0,
      durationDays: 0,
      hours: 0
    };
  }

  if (days < 0) {
    return {
      kind: "past",
      targetDate: config.targetDate,
      days: Math.abs(days),
      durationDays: Math.abs(days),
      hours: 0
    };
  }

  const totalHours = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (60 * 60 * 1000)));

  return {
    kind: "future",
    targetDate: config.targetDate,
    days,
    durationDays: Math.floor(totalHours / 24),
    hours: totalHours % 24
  };
}

export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
