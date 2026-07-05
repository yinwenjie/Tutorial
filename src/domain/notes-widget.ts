export const NOTES_WIDGET_MAX_ITEMS = 20;
export const NOTES_WIDGET_MAX_TEXT_LENGTH = 500;

export interface NoteItem {
  id: string;
  text: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotesWidgetConfig extends Record<string, unknown> {
  notes: NoteItem[];
}

export function createNoteItem(id: string, text: string, order: number): NoteItem {
  const now = new Date().toISOString();

  return {
    id,
    text: normalizeNoteText(text),
    order,
    createdAt: now,
    updatedAt: now
  };
}

export function normalizeNotesConfig(input: unknown): NotesWidgetConfig {
  const notes = isRecord(input) && Array.isArray(input.notes)
    ? input.notes
      .filter(isRecord)
      .map((item, index) => {
        const createdAt = normalizeIsoDateString(item.createdAt);
        const updatedAt = normalizeIsoDateString(item.updatedAt);

        return {
          id: readString(item.id) || `note-${index + 1}`,
          text: normalizeNoteText(item.text),
          order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1,
          createdAt: createdAt || updatedAt || new Date().toISOString(),
          updatedAt: updatedAt || createdAt || new Date().toISOString()
        };
      })
      .filter((item) => item.text)
      .slice(0, NOTES_WIDGET_MAX_ITEMS)
    : [];

  return {
    notes: renumberNoteItems(notes)
  };
}

export function readNoteItems(config: Record<string, unknown>): NoteItem[] {
  return normalizeNotesConfig(config).notes;
}

export function renumberNoteItems(items: NoteItem[]): NoteItem[] {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .slice(0, NOTES_WIDGET_MAX_ITEMS)
    .map((item, index) => ({
      ...item,
      order: index + 1
    }));
}

export function normalizeNoteText(value: unknown): string {
  return readString(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, NOTES_WIDGET_MAX_TEXT_LENGTH);
}

export function getNotesStats(items: NoteItem[]) {
  return {
    total: items.length
  };
}

function normalizeIsoDateString(value: unknown): string {
  const text = readString(value);
  if (!text) {
    return "";
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
