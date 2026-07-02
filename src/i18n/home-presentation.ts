import type { HomeWidgetType, SyncStatus } from "@/domain/home-document";
import type { HomeTemplateId } from "@/domain/home-template";
import type { HomeWidgetPreset } from "@/domain/home-widget";
import type { I18nTranslate } from "@/i18n/messages";

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
  switch (preset.title) {
    case "本月概览":
      return t("template.widget.thisMonthOverview");
    case "今日待办":
      return t("template.widget.todayTodo");
    case "工作待办":
      return t("template.widget.workTodo");
    case "会议与日程":
      return t("template.widget.meetingSchedule");
    case "开发任务":
      return t("template.widget.devTasks");
    case "本月节奏":
      return t("template.widget.monthlyRhythm");
    case "学习计划":
      return t("template.widget.studyPlan");
    case "学习日历":
      return t("template.widget.studyCalendar");
    default:
      return formatHomeWidgetDefaultTitle(preset.type, t);
  }
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
