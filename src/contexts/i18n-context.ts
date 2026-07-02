"use client";

import { createContext } from "react";
import type { LocalePreference, ResolvedLocale } from "@/domain/ui-preferences";
import type { I18nFormatters } from "@/i18n/formatters";
import type { I18nTranslate } from "@/i18n/messages";

export interface I18nState {
  locale: ResolvedLocale;
  localePreference: LocalePreference;
  t: I18nTranslate;
  format: I18nFormatters;
}

export const I18nContext = createContext<I18nState | null>(null);
