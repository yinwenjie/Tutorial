export const WORLD_CLOCK_MAX_ITEMS = 6;
export const WORLD_CLOCK_LABEL_MAX_LENGTH = 40;

export interface WorldClockItem {
  id: string;
  label: string;
  timeZone: WorldClockTimeZone;
  order: number;
}

export interface WorldClockWidgetConfig extends Record<string, unknown> {
  clocks: WorldClockItem[];
}

export interface WorldClockTimeZoneOption {
  timeZone: WorldClockTimeZone;
  defaultLabel: string;
}

export type WorldClockTimeZone =
  | "UTC"
  | "Asia/Shanghai"
  | "Asia/Tokyo"
  | "Asia/Seoul"
  | "Europe/London"
  | "Europe/Paris"
  | "America/New_York"
  | "America/Chicago"
  | "America/Los_Angeles";

export const WORLD_CLOCK_TIME_ZONE_OPTIONS: readonly WorldClockTimeZoneOption[] = [
  { timeZone: "UTC", defaultLabel: "UTC" },
  { timeZone: "Asia/Shanghai", defaultLabel: "Shanghai" },
  { timeZone: "Asia/Tokyo", defaultLabel: "Tokyo" },
  { timeZone: "Asia/Seoul", defaultLabel: "Seoul" },
  { timeZone: "Europe/London", defaultLabel: "London" },
  { timeZone: "Europe/Paris", defaultLabel: "Paris" },
  { timeZone: "America/New_York", defaultLabel: "New York" },
  { timeZone: "America/Chicago", defaultLabel: "Chicago" },
  { timeZone: "America/Los_Angeles", defaultLabel: "Los Angeles" }
] as const;

export const DEFAULT_WORLD_CLOCK_TIME_ZONE: WorldClockTimeZone = "UTC";

const WORLD_CLOCK_TIME_ZONE_SET = new Set<string>(WORLD_CLOCK_TIME_ZONE_OPTIONS.map((option) => option.timeZone));

export function createWorldClockItem(id: string, label: string, timeZone: WorldClockTimeZone, order: number): WorldClockItem {
  return {
    id,
    label: normalizeWorldClockLabel(label),
    timeZone,
    order
  };
}

export function normalizeWorldClockConfig(input: unknown): WorldClockWidgetConfig {
  const clocks = isRecord(input) && Array.isArray(input.clocks)
    ? input.clocks
      .filter(isRecord)
      .map((item, index) => {
        const timeZone = normalizeWorldClockTimeZone(item.timeZone);
        if (!timeZone) {
          return null;
        }

        return {
          id: readString(item.id) || `clock-${index + 1}`,
          label: normalizeWorldClockLabel(item.label),
          timeZone,
          order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1
        };
      })
      .filter((item): item is WorldClockItem => Boolean(item))
      .slice(0, WORLD_CLOCK_MAX_ITEMS)
    : [];

  return {
    clocks: renumberWorldClockItems(clocks)
  };
}

export function readWorldClockItems(config: Record<string, unknown>): WorldClockItem[] {
  return normalizeWorldClockConfig(config).clocks;
}

export function renumberWorldClockItems(items: WorldClockItem[]): WorldClockItem[] {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .slice(0, WORLD_CLOCK_MAX_ITEMS)
    .map((item, index) => ({
      ...item,
      order: index + 1
    }));
}

export function normalizeWorldClockLabel(value: unknown): string {
  return readString(value).replace(/\s+/g, " ").slice(0, WORLD_CLOCK_LABEL_MAX_LENGTH);
}

export function normalizeWorldClockTimeZone(value: unknown): WorldClockTimeZone | null {
  const timeZone = readString(value);
  return WORLD_CLOCK_TIME_ZONE_SET.has(timeZone) ? timeZone as WorldClockTimeZone : null;
}

export function getWorldClockFallbackLabel(timeZone: WorldClockTimeZone): string {
  return WORLD_CLOCK_TIME_ZONE_OPTIONS.find((option) => option.timeZone === timeZone)?.defaultLabel ?? timeZone;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
