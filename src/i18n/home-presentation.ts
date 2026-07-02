import type { HomeWidget, HomeWidgetType, SyncStatus } from "@/domain/home-document";
import type { HomeTemplateId } from "@/domain/home-template";
import type { HomeWidgetPreset } from "@/domain/home-widget";
import type { I18nMessageKey, I18nTranslate } from "@/i18n/messages";

const SYSTEM_WIDGET_DEFAULT_TITLES: Record<HomeWidgetType, Set<string>> = {
  "todo.list": new Set(["Todo"]),
  "calendar.month": new Set(["月历", "月曆", "Calendar", "Calendrier", "Calendario", "カレンダー", "달력"])
};

const SYSTEM_WIDGET_PRESET_TITLE_KEYS: Record<string, I18nMessageKey> = {
  "本月概览": "template.widget.thisMonthOverview",
  "今日待办": "template.widget.todayTodo",
  "工作待办": "template.widget.workTodo",
  "会议与日程": "template.widget.meetingSchedule",
  "开发任务": "template.widget.devTasks",
  "本月节奏": "template.widget.monthlyRhythm",
  "学习计划": "template.widget.studyPlan",
  "学习日历": "template.widget.studyCalendar"
};

export function formatHomeTemplateName(templateId: HomeTemplateId, t: I18nTranslate): string {
  switch (templateId) {
    case "blank":
      return t("template.blank.name");
    case "minimal":
      return t("template.minimal.name");
    case "general-productivity":
      return t("template.generalProductivity.name");
    case "work-office":
      return t("template.workOffice.name");
    case "developer-workbench":
      return t("template.developerWorkbench.name");
    case "learning-research":
      return t("template.learningResearch.name");
  }
}

export function formatHomeTemplateSummary(templateId: HomeTemplateId, t: I18nTranslate): string {
  switch (templateId) {
    case "blank":
      return t("template.blank.summary");
    case "minimal":
      return t("template.minimal.summary");
    case "general-productivity":
      return t("template.generalProductivity.summary");
    case "work-office":
      return t("template.workOffice.summary");
    case "developer-workbench":
      return t("template.developerWorkbench.summary");
    case "learning-research":
      return t("template.learningResearch.summary");
  }
}

export function formatHomeWidgetTitle(type: HomeWidgetType, t: I18nTranslate): string {
  switch (type) {
    case "todo.list":
      return t("widget.definition.todo.title");
    case "calendar.month":
      return t("widget.definition.calendar.title");
  }
}

export function formatHomeWidgetDefaultTitle(type: HomeWidgetType, t: I18nTranslate): string {
  switch (type) {
    case "todo.list":
      return t("widget.definition.todo.defaultTitle");
    case "calendar.month":
      return t("widget.definition.calendar.defaultTitle");
  }
}

export function formatHomeWidgetDisplayTitle(widget: Pick<HomeWidget, "type" | "title">, t: I18nTranslate): string {
  const title = widget.title.trim();
  const presetKey = SYSTEM_WIDGET_PRESET_TITLE_KEYS[title];
  if (presetKey) {
    return t(presetKey);
  }

  if (SYSTEM_WIDGET_DEFAULT_TITLES[widget.type].has(title)) {
    return formatHomeWidgetDefaultTitle(widget.type, t);
  }

  return widget.title;
}

export function formatHomeWidgetDescription(type: HomeWidgetType, t: I18nTranslate): string {
  switch (type) {
    case "todo.list":
      return t("widget.definition.todo.description");
    case "calendar.month":
      return t("widget.definition.calendar.description");
  }
}

export function formatHomeWidgetSettingsTitle(type: HomeWidgetType, t: I18nTranslate): string {
  switch (type) {
    case "todo.list":
      return t("widget.definition.todo.settingsTitle");
    case "calendar.month":
      return t("widget.definition.calendar.settingsTitle");
  }
}

export function formatHomeWidgetSettingsDescription(type: HomeWidgetType, t: I18nTranslate): string {
  switch (type) {
    case "todo.list":
      return t("widget.definition.todo.settingsDescription");
    case "calendar.month":
      return t("widget.definition.calendar.settingsDescription");
  }
}

export function formatHomeWidgetPresetTitle(preset: HomeWidgetPreset, t: I18nTranslate): string {
  if (preset.title) {
    return formatHomeWidgetDisplayTitle({
      type: preset.type,
      title: preset.title
    }, t);
  }

  return formatHomeWidgetDefaultTitle(preset.type, t);
}

export function formatSyncStatus(status: SyncStatus, t: I18nTranslate): string {
  switch (status) {
    case "local-only":
      return t("syncStatus.localOnly");
    case "linked":
      return t("syncStatus.linked");
    case "syncing":
      return t("syncStatus.syncing");
    case "synced":
      return t("syncStatus.synced");
    case "paused":
      return t("syncStatus.paused");
    case "offline":
      return t("syncStatus.offline");
    case "conflict":
      return t("syncStatus.conflict");
    case "error":
      return t("syncStatus.error");
  }
}
