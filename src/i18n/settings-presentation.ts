import type { HomeSpace } from "@/domain/account";
import type { HomeThemeAsset, HomeThemeAssetSlot } from "@/domain/home-document";
import type { HomeThemePresetId } from "@/domain/theme-preset";
import type { I18nMessageKey, I18nTranslate } from "@/i18n/messages";

const THEME_PRESET_MESSAGE_KEYS: Record<HomeThemePresetId, { description: I18nMessageKey; name: I18nMessageKey }> = {
  classic: {
    description: "settings.theme.preset.classic.description",
    name: "settings.theme.preset.classic.name"
  },
  dense: {
    description: "settings.theme.preset.dense.description",
    name: "settings.theme.preset.dense.name"
  },
  editorial: {
    description: "settings.theme.preset.editorial.description",
    name: "settings.theme.preset.editorial.name"
  },
  focus: {
    description: "settings.theme.preset.focus.description",
    name: "settings.theme.preset.focus.name"
  },
  glass: {
    description: "settings.theme.preset.glass.description",
    name: "settings.theme.preset.glass.name"
  },
  indigo: {
    description: "settings.theme.preset.indigo.description",
    name: "settings.theme.preset.indigo.name"
  },
  millennium: {
    description: "settings.theme.preset.millennium.description",
    name: "settings.theme.preset.millennium.name"
  },
  mint: {
    description: "settings.theme.preset.mint.description",
    name: "settings.theme.preset.mint.name"
  },
  mono: {
    description: "settings.theme.preset.mono.description",
    name: "settings.theme.preset.mono.name"
  },
  slate: {
    description: "settings.theme.preset.slate.description",
    name: "settings.theme.preset.slate.name"
  },
  soft: {
    description: "settings.theme.preset.soft.description",
    name: "settings.theme.preset.soft.name"
  },
  sunrise: {
    description: "settings.theme.preset.sunrise.description",
    name: "settings.theme.preset.sunrise.name"
  },
  terminal: {
    description: "settings.theme.preset.terminal.description",
    name: "settings.theme.preset.terminal.name"
  }
};

export function formatSettingsThemePresetName(presetId: HomeThemePresetId, t: I18nTranslate): string {
  return t(THEME_PRESET_MESSAGE_KEYS[presetId].name);
}

export function formatSettingsThemePresetDescription(presetId: HomeThemePresetId, t: I18nTranslate): string {
  return t(THEME_PRESET_MESSAGE_KEYS[presetId].description);
}

export function formatSettingsImageSlot(slot: HomeThemeAssetSlot, t: I18nTranslate): string {
  return t(slot === "banner" ? "settings.images.slot.banner" : "settings.images.slot.background");
}

export function formatSettingsImageAsset(asset: HomeThemeAsset | null, t: I18nTranslate): string {
  if (!asset) {
    return t("settings.images.assetEmpty");
  }

  return asset.source === "storage" ? t("settings.images.assetStorage") : t("settings.images.assetExternal");
}

export function formatSettingsHomeSpaceAccessMode(accessMode: HomeSpace["accessMode"], t: I18nTranslate): string {
  if (accessMode === "account-managed") {
    return t("settings.homeSpaces.access.accountManaged");
  }

  if (accessMode === "password-protected") {
    return t("settings.homeSpaces.access.passwordProtected");
  }

  return t("settings.homeSpaces.access.syncCode");
}

export function formatSettingsSnapshotAssets(hasBanner: boolean, hasBackground: boolean, t: I18nTranslate): string {
  if (hasBanner && hasBackground) {
    return t("settings.recovery.assetsBoth");
  }

  if (hasBanner) {
    return t("settings.recovery.assetsBanner");
  }

  if (hasBackground) {
    return t("settings.recovery.assetsBackground");
  }

  return t("settings.recovery.assetsNone");
}
