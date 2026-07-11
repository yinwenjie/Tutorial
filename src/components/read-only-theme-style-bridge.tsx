"use client";

import { useEffect } from "react";
import type { HomeThemePresetId } from "@/domain/theme-preset";
import {
  HOME_THEME_CSS_VARIABLE_NAMES,
  getHomeThemeAppearanceAttribute,
  getHomeThemeCssVariables,
  type HomeThemeColorScheme
} from "@/domain/theme-preset";

export interface ReadOnlyHomeTheme {
  presetId: HomeThemePresetId;
  accent: string;
}

interface ReadOnlyThemeStyleBridgeProps {
  theme: ReadOnlyHomeTheme;
  colorScheme?: HomeThemeColorScheme | "system";
}

/** Applies visual tokens only; it never resolves account-bound theme assets. */
export function ReadOnlyThemeStyleBridge({
  theme,
  colorScheme = "system"
}: ReadOnlyThemeStyleBridgeProps) {
  useEffect(() => {
    const root = document.documentElement;
    const darkSchemeMedia = window.matchMedia("(prefers-color-scheme: dark)");

    function applyThemeVariables() {
      const scheme: HomeThemeColorScheme = colorScheme === "system"
        ? (darkSchemeMedia.matches ? "dark" : "light")
        : colorScheme;
      const variables = getHomeThemeCssVariables(theme, scheme);

      root.dataset.appearancePreset = getHomeThemeAppearanceAttribute(theme);
      for (const [name, value] of Object.entries(variables)) {
        root.style.setProperty(name, value);
      }

      root.style.setProperty("--home-banner-image", "none");
      root.style.setProperty("--home-background-image", "none");
      root.style.setProperty("--home-background-image-scrim", "linear-gradient(transparent, transparent)");
    }

    applyThemeVariables();
    if (colorScheme === "system") {
      darkSchemeMedia.addEventListener("change", applyThemeVariables);
    }

    return () => {
      darkSchemeMedia.removeEventListener("change", applyThemeVariables);
      delete root.dataset.appearancePreset;
      for (const name of HOME_THEME_CSS_VARIABLE_NAMES) {
        root.style.removeProperty(name);
      }
      root.style.removeProperty("--home-banner-image");
      root.style.removeProperty("--home-background-image");
      root.style.removeProperty("--home-background-image-scrim");
    };
  }, [colorScheme, theme]);

  return null;
}
