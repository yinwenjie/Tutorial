"use client";

import { type CSSProperties, type FormEvent, type ReactNode, useState } from "react";
import { normalizeText } from "@/domain/home-document";
import { useI18n } from "@/hooks/use-i18n";

interface WidgetShellProps {
  title: string;
  displayTitle: string;
  defaultTitle: string;
  description: string;
  manageMode: boolean;
  collapsed: boolean;
  widgetIndex: number;
  widgetsLength: number;
  collapsedSummary: string;
  children: ReactNode;
  dragHandle?: ReactNode;
  isDragging?: boolean;
  articleRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  onRenameTitle: (title: string) => void;
  onOpenSettings: () => void;
  onToggleCollapsed: () => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}

export function WidgetShell({
  title,
  displayTitle,
  defaultTitle,
  description,
  manageMode,
  collapsed,
  widgetIndex,
  widgetsLength,
  collapsedSummary,
  children,
  dragHandle,
  isDragging = false,
  articleRef,
  style,
  onRenameTitle,
  onOpenSettings,
  onToggleCollapsed,
  onMove,
  onDelete
}: WidgetShellProps) {
  const { t } = useI18n();
  const [titleDraftState, setTitleDraftState] = useState({
    sourceTitle: title,
    value: title
  });
  const titleDraft = titleDraftState.sourceTitle === title ? titleDraftState.value : title;

  function commitTitle() {
    const nextTitle = normalizeText(titleDraft) || defaultTitle;

    setTitleDraftState({
      sourceTitle: nextTitle,
      value: nextTitle
    });
    onRenameTitle(nextTitle);
  }

  function handleTitleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.currentTarget.querySelector("input")?.blur();
  }

  return (
    <article
      ref={articleRef}
      className={[
        "widget-card",
        manageMode ? "is-managing" : "",
        collapsed ? "is-collapsed" : "",
        isDragging ? "is-dragging" : ""
      ].filter(Boolean).join(" ")}
      style={style}
    >
      <div className="widget-card-head">
        {manageMode ? dragHandle : null}
        <div className="widget-card-copy">
          {manageMode ? (
            <form className="widget-title-form" onSubmit={handleTitleSubmit}>
              <input
                className="widget-title-input"
                value={titleDraft}
                aria-label={t("widgetShell.titleInputAria", { title: displayTitle })}
                onBlur={commitTitle}
                onChange={(event) => setTitleDraftState({
                  sourceTitle: title,
                  value: event.target.value
                })}
              />
            </form>
          ) : (
            <strong title={displayTitle}>{displayTitle}</strong>
          )}
          <span title={description}>{description}</span>
        </div>
        <div className="widget-card-actions">
          {!manageMode ? (
            <button
              className="mini-button widget-shell-settings-action"
              type="button"
              aria-label={t("widgetShell.configureAria", { title: displayTitle })}
              title={t("widgetShell.settingsTitle")}
              onClick={onOpenSettings}
            >
              ⚙
            </button>
          ) : null}
          <button
            className="mini-button widget-shell-primary-action"
            type="button"
            aria-expanded={!collapsed}
            aria-label={collapsed ? t("widgetShell.expandAria", { title: displayTitle }) : t("widgetShell.collapseAria", { title: displayTitle })}
            title={collapsed ? t("widgetShell.expandTitle") : t("widgetShell.collapseTitle")}
            onClick={onToggleCollapsed}
          >
            {collapsed ? "▾" : "▴"}
          </button>
          {manageMode ? (
            <span className="widget-shell-management-actions">
              <button
                className="mini-button"
                type="button"
                disabled={widgetIndex === 0}
                aria-label={t("widgetShell.moveUpAria", { title: displayTitle })}
                title={t("widgetShell.moveUpTitle")}
                onClick={() => onMove(-1)}
              >
                ↑
              </button>
              <button
                className="mini-button"
                type="button"
                disabled={widgetIndex === widgetsLength - 1}
                aria-label={t("widgetShell.moveDownAria", { title: displayTitle })}
                title={t("widgetShell.moveDownTitle")}
                onClick={() => onMove(1)}
              >
                ↓
              </button>
              <button
                className="mini-button"
                type="button"
                aria-label={t("widgetShell.deleteAria", { title: displayTitle })}
                title={t("common.delete")}
                onClick={onDelete}
              >
                ×
              </button>
            </span>
          ) : null}
        </div>
      </div>
      {collapsed ? (
        <p className="widget-collapsed-summary">{collapsedSummary}</p>
      ) : (
        children
      )}
    </article>
  );
}
