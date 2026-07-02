import type { ResolvedLocale } from "@/domain/ui-preferences";

export const DEFAULT_MESSAGES = {
  "calendar.previousMonthAria": "查看{month}",
  "calendar.nextMonthAria": "查看{month}",
  "calendar.previousMonthTitle": "上个月",
  "calendar.nextMonthTitle": "下个月",
  "calendar.todayCurrent": "今日 {date}",
  "calendar.todayReference": "今天 {date}",
  "calendar.todayButton": "回今天",
  "calendar.todayButtonCurrentTitle": "正在查看本月",
  "calendar.todayButtonTitle": "回到今天",
  "calendar.weekStartMonday": "周一开始",
  "calendar.weekStartSunday": "周日开始",
  "calendar.ariaLabel": "{month}月历",
  "calendar.dayTitle": "{date}",
  "calendar.todayDayTitle": "{date} 今天",
  "widget.todoEmpty": "暂无任务",
  "widget.todoSummary": "{active} 项待办 / {total} 项任务",
  "widget.calendarSummary": "{month} · {today} · {weekStart}",
  "widget.collapsedFallback": "组件已折叠"
} as const;

export type I18nMessageKey = keyof typeof DEFAULT_MESSAGES;
export type I18nMessageParams = Record<string, string | number>;
export type I18nTranslate = (key: I18nMessageKey, params?: I18nMessageParams) => string;

type MessageDictionary = Record<I18nMessageKey, string>;

const LOCALE_MESSAGES: Record<ResolvedLocale, Partial<MessageDictionary>> = {
  "zh-CN": DEFAULT_MESSAGES,
  "zh-TW": {
    "calendar.previousMonthAria": "查看{month}",
    "calendar.nextMonthAria": "查看{month}",
    "calendar.previousMonthTitle": "上個月",
    "calendar.nextMonthTitle": "下個月",
    "calendar.todayCurrent": "今日 {date}",
    "calendar.todayReference": "今天 {date}",
    "calendar.todayButton": "回今天",
    "calendar.todayButtonCurrentTitle": "正在查看本月",
    "calendar.todayButtonTitle": "回到今天",
    "calendar.weekStartMonday": "週一開始",
    "calendar.weekStartSunday": "週日開始",
    "calendar.ariaLabel": "{month}月曆",
    "calendar.todayDayTitle": "{date} 今天",
    "widget.todoEmpty": "暫無任務",
    "widget.todoSummary": "{active} 項待辦 / {total} 項任務",
    "widget.collapsedFallback": "組件已折疊"
  },
  "en-US": {
    "calendar.previousMonthAria": "View {month}",
    "calendar.nextMonthAria": "View {month}",
    "calendar.previousMonthTitle": "Previous month",
    "calendar.nextMonthTitle": "Next month",
    "calendar.todayCurrent": "Today {date}",
    "calendar.todayReference": "Today {date}",
    "calendar.todayButton": "Today",
    "calendar.todayButtonCurrentTitle": "Viewing this month",
    "calendar.todayButtonTitle": "Back to today",
    "calendar.weekStartMonday": "Starts Monday",
    "calendar.weekStartSunday": "Starts Sunday",
    "calendar.ariaLabel": "{month} calendar",
    "calendar.todayDayTitle": "{date} today",
    "widget.todoEmpty": "No tasks",
    "widget.todoSummary": "{active} open / {total} tasks",
    "widget.collapsedFallback": "Widget collapsed"
  },
  "fr-FR": {
    "calendar.previousMonthAria": "Voir {month}",
    "calendar.nextMonthAria": "Voir {month}",
    "calendar.previousMonthTitle": "Mois précédent",
    "calendar.nextMonthTitle": "Mois suivant",
    "calendar.todayCurrent": "Aujourd'hui {date}",
    "calendar.todayReference": "Aujourd'hui {date}",
    "calendar.todayButton": "Aujourd'hui",
    "calendar.todayButtonCurrentTitle": "Mois actuel affiché",
    "calendar.todayButtonTitle": "Revenir à aujourd'hui",
    "calendar.weekStartMonday": "Commence lundi",
    "calendar.weekStartSunday": "Commence dimanche",
    "calendar.ariaLabel": "Calendrier {month}",
    "calendar.todayDayTitle": "{date} aujourd'hui",
    "widget.todoEmpty": "Aucune tâche",
    "widget.todoSummary": "{active} en cours / {total} tâches",
    "widget.collapsedFallback": "Widget réduit"
  },
  "es-ES": {
    "calendar.previousMonthAria": "Ver {month}",
    "calendar.nextMonthAria": "Ver {month}",
    "calendar.previousMonthTitle": "Mes anterior",
    "calendar.nextMonthTitle": "Mes siguiente",
    "calendar.todayCurrent": "Hoy {date}",
    "calendar.todayReference": "Hoy {date}",
    "calendar.todayButton": "Hoy",
    "calendar.todayButtonCurrentTitle": "Viendo este mes",
    "calendar.todayButtonTitle": "Volver a hoy",
    "calendar.weekStartMonday": "Empieza el lunes",
    "calendar.weekStartSunday": "Empieza el domingo",
    "calendar.ariaLabel": "Calendario de {month}",
    "calendar.todayDayTitle": "{date} hoy",
    "widget.todoEmpty": "Sin tareas",
    "widget.todoSummary": "{active} pendientes / {total} tareas",
    "widget.collapsedFallback": "Widget contraído"
  },
  "ja-JP": {
    "calendar.previousMonthAria": "{month}を表示",
    "calendar.nextMonthAria": "{month}を表示",
    "calendar.previousMonthTitle": "前の月",
    "calendar.nextMonthTitle": "次の月",
    "calendar.todayCurrent": "今日 {date}",
    "calendar.todayReference": "今日 {date}",
    "calendar.todayButton": "今日",
    "calendar.todayButtonCurrentTitle": "今月を表示中",
    "calendar.todayButtonTitle": "今日に戻る",
    "calendar.weekStartMonday": "月曜始まり",
    "calendar.weekStartSunday": "日曜始まり",
    "calendar.ariaLabel": "{month}のカレンダー",
    "calendar.todayDayTitle": "{date} 今日",
    "widget.todoEmpty": "タスクなし",
    "widget.todoSummary": "未完了 {active} / 全 {total} 件",
    "widget.collapsedFallback": "ウィジェットは折りたたまれています"
  },
  "ko-KR": {
    "calendar.previousMonthAria": "{month} 보기",
    "calendar.nextMonthAria": "{month} 보기",
    "calendar.previousMonthTitle": "이전 달",
    "calendar.nextMonthTitle": "다음 달",
    "calendar.todayCurrent": "오늘 {date}",
    "calendar.todayReference": "오늘 {date}",
    "calendar.todayButton": "오늘",
    "calendar.todayButtonCurrentTitle": "이번 달 보는 중",
    "calendar.todayButtonTitle": "오늘로 돌아가기",
    "calendar.weekStartMonday": "월요일 시작",
    "calendar.weekStartSunday": "일요일 시작",
    "calendar.ariaLabel": "{month} 달력",
    "calendar.todayDayTitle": "{date} 오늘",
    "widget.todoEmpty": "작업 없음",
    "widget.todoSummary": "진행 {active} / 전체 {total}개",
    "widget.collapsedFallback": "위젯 접힘"
  },
  "it-IT": {
    "calendar.previousMonthAria": "Visualizza {month}",
    "calendar.nextMonthAria": "Visualizza {month}",
    "calendar.previousMonthTitle": "Mese precedente",
    "calendar.nextMonthTitle": "Mese successivo",
    "calendar.todayCurrent": "Oggi {date}",
    "calendar.todayReference": "Oggi {date}",
    "calendar.todayButton": "Oggi",
    "calendar.todayButtonCurrentTitle": "Stai visualizzando questo mese",
    "calendar.todayButtonTitle": "Torna a oggi",
    "calendar.weekStartMonday": "Inizia lunedi",
    "calendar.weekStartSunday": "Inizia domenica",
    "calendar.ariaLabel": "Calendario di {month}",
    "calendar.todayDayTitle": "{date} oggi",
    "widget.todoEmpty": "Nessuna attivita",
    "widget.todoSummary": "{active} aperte / {total} attivita",
    "widget.collapsedFallback": "Widget compresso"
  }
};

export function createTranslator(locale: ResolvedLocale): I18nTranslate {
  return (key, params = {}) => interpolateMessage(getMessage(locale, key), params);
}

function getMessage(locale: ResolvedLocale, key: I18nMessageKey): string {
  return LOCALE_MESSAGES[locale]?.[key] ?? DEFAULT_MESSAGES[key] ?? key;
}

function interpolateMessage(message: string, params: I18nMessageParams): string {
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, paramKey: string) => {
    const value = params[paramKey];
    return value === undefined ? match : String(value);
  });
}
