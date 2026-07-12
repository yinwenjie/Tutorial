import {
  normalizeHomeDocument,
  type HomeDocumentV2
} from "@/domain/home-document";
import {
  isHomeThemePresetId,
  normalizeThemeAccent,
  type HomeThemePresetId
} from "@/domain/theme-preset";

export const PUBLIC_HOME_DOCUMENT_VERSION = 1;
export const PUBLIC_HOME_MAX_GROUPS = 60;
export const PUBLIC_HOME_MAX_SITES_PER_GROUP = 100;
export const PUBLIC_HOME_MAX_TOTAL_SITES = 2_000;
export const PUBLIC_HOME_MAX_DOCUMENT_TITLE_LENGTH = 80;
export const PUBLIC_HOME_MAX_GROUP_TITLE_LENGTH = 80;
export const PUBLIC_HOME_MAX_SITE_NAME_LENGTH = 80;
export const PUBLIC_HOME_MAX_SITE_MARK_LENGTH = 20;
export const PUBLIC_HOME_MAX_SITE_URL_LENGTH = 2_048;
export const PUBLIC_HOME_MAX_PAYLOAD_BYTES = 256 * 1_024;

export interface ReadOnlyHomeTheme {
  presetId: HomeThemePresetId;
  accent: string;
}

export interface ReadOnlyHomeSite {
  id: string;
  name: string;
  url: string;
  mark: string;
  order: number;
}

export interface ReadOnlyHomeGroup {
  id: string;
  title: string;
  order: number;
  sites: ReadOnlyHomeSite[];
}

export interface ReadOnlyHomeDocument {
  documentTitle: string;
  theme: ReadOnlyHomeTheme;
  groups: ReadOnlyHomeGroup[];
}

export interface PublicHomeDocumentV1 extends ReadOnlyHomeDocument {
  version: typeof PUBLIC_HOME_DOCUMENT_VERSION;
}

export type PublicHomeDocumentErrorCode =
  | "invalid-source"
  | "unsupported-version"
  | "empty-content"
  | "group-limit-exceeded"
  | "site-limit-exceeded"
  | "field-limit-exceeded"
  | "unsafe-url"
  | "payload-too-large";

export type PublicHomeDocumentResult =
  | {
      ok: true;
      document: PublicHomeDocumentV1;
      serialized: string;
      byteSize: number;
    }
  | {
      ok: false;
      code: PublicHomeDocumentErrorCode;
      path?: string;
    };

export function createPublicHomeDocument(source: HomeDocumentV2): PublicHomeDocumentResult {
  const sourceError = validateProjectionSource(source);
  if (sourceError) {
    return sourceError;
  }

  let normalized: HomeDocumentV2;

  try {
    normalized = normalizeHomeDocument(source);
  } catch {
    return failure("invalid-source");
  }

  const titleError = validateTextField(
    normalized.documentTitle,
    PUBLIC_HOME_MAX_DOCUMENT_TITLE_LENGTH,
    "documentTitle"
  );
  if (titleError) {
    return titleError;
  }

  const accent = normalizeThemeAccent(normalized.theme.accent);
  if (!isHomeThemePresetId(normalized.theme.presetId) || !accent) {
    return failure("invalid-source", "theme");
  }

  const publicGroups: ReadOnlyHomeGroup[] = [];
  let totalSites = 0;
  const sortedGroups = [...normalized.groups].sort((left, right) => left.order - right.order);

  for (const sourceGroup of sortedGroups) {
    const sortedSites = [...sourceGroup.sites].sort((left, right) => left.order - right.order);
    if (sortedSites.length === 0) {
      continue;
    }

    if (publicGroups.length >= PUBLIC_HOME_MAX_GROUPS) {
      return failure("group-limit-exceeded", "groups");
    }

    const groupIndex = publicGroups.length + 1;
    const groupPath = `groups[${groupIndex - 1}]`;
    const groupTitleError = validateTextField(
      sourceGroup.title,
      PUBLIC_HOME_MAX_GROUP_TITLE_LENGTH,
      `${groupPath}.title`
    );
    if (groupTitleError) {
      return groupTitleError;
    }

    if (sortedSites.length > PUBLIC_HOME_MAX_SITES_PER_GROUP) {
      return failure("site-limit-exceeded", `${groupPath}.sites`);
    }

    const publicSites: ReadOnlyHomeSite[] = [];
    for (const sourceSite of sortedSites) {
      totalSites += 1;
      if (totalSites > PUBLIC_HOME_MAX_TOTAL_SITES) {
        return failure("site-limit-exceeded", "groups[].sites");
      }

      const siteIndex = publicSites.length + 1;
      const sitePath = `${groupPath}.sites[${siteIndex - 1}]`;
      const nameError = validateTextField(
        sourceSite.name,
        PUBLIC_HOME_MAX_SITE_NAME_LENGTH,
        `${sitePath}.name`
      );
      if (nameError) {
        return nameError;
      }

      const markError = validateTextField(
        sourceSite.mark,
        PUBLIC_HOME_MAX_SITE_MARK_LENGTH,
        `${sitePath}.mark`
      );
      if (markError) {
        return markError;
      }

      const urlResult = normalizePublicUrl(sourceSite.url, `${sitePath}.url`);
      if (!urlResult.ok) {
        return urlResult;
      }

      publicSites.push({
        id: `site-${groupIndex}-${siteIndex}`,
        name: sourceSite.name,
        url: urlResult.url,
        mark: sourceSite.mark,
        order: siteIndex
      });
    }

    publicGroups.push({
      id: `group-${groupIndex}`,
      title: sourceGroup.title,
      order: groupIndex,
      sites: publicSites
    });
  }

  if (publicGroups.length === 0) {
    return failure("empty-content");
  }

  return finalize({
    version: PUBLIC_HOME_DOCUMENT_VERSION,
    documentTitle: normalized.documentTitle,
    theme: {
      presetId: normalized.theme.presetId,
      accent
    },
    groups: publicGroups
  });
}

function validateProjectionSource(
  source: unknown
): Extract<PublicHomeDocumentResult, { ok: false }> | null {
  if (!isRecord(source) || !Array.isArray(source.groups)) {
    return failure("invalid-source");
  }

  const titleError = validateTextField(
    source.documentTitle,
    PUBLIC_HOME_MAX_DOCUMENT_TITLE_LENGTH,
    "documentTitle"
  );
  if (titleError) {
    return titleError;
  }

  if (!isRecord(source.theme)
    || !isHomeThemePresetId(source.theme.presetId)
    || !normalizeThemeAccent(source.theme.accent)) {
    return failure("invalid-source", "theme");
  }

  let publicGroupCount = 0;
  let totalSites = 0;
  for (let groupIndex = 0; groupIndex < source.groups.length; groupIndex += 1) {
    const group = source.groups[groupIndex];
    if (!isRecord(group) || !Array.isArray(group.sites)) {
      return failure("invalid-source", `groups[${groupIndex}]`);
    }

    if (group.sites.length === 0) {
      continue;
    }

    publicGroupCount += 1;
    if (publicGroupCount > PUBLIC_HOME_MAX_GROUPS) {
      return failure("group-limit-exceeded", "groups");
    }

    const groupTitleError = validateTextField(
      group.title,
      PUBLIC_HOME_MAX_GROUP_TITLE_LENGTH,
      `groups[${groupIndex}].title`
    );
    if (groupTitleError) {
      return groupTitleError;
    }

    if (group.sites.length > PUBLIC_HOME_MAX_SITES_PER_GROUP) {
      return failure("site-limit-exceeded", `groups[${groupIndex}].sites`);
    }

    for (let siteIndex = 0; siteIndex < group.sites.length; siteIndex += 1) {
      const site = group.sites[siteIndex];
      const sitePath = `groups[${groupIndex}].sites[${siteIndex}]`;
      if (!isRecord(site)) {
        return failure("invalid-source", sitePath);
      }

      totalSites += 1;
      if (totalSites > PUBLIC_HOME_MAX_TOTAL_SITES) {
        return failure("site-limit-exceeded", "groups[].sites");
      }

      const nameError = validateTextField(
        site.name,
        PUBLIC_HOME_MAX_SITE_NAME_LENGTH,
        `${sitePath}.name`
      );
      if (nameError) {
        return nameError;
      }

      const markError = validateTextField(
        site.mark,
        PUBLIC_HOME_MAX_SITE_MARK_LENGTH,
        `${sitePath}.mark`
      );
      if (markError) {
        return markError;
      }

      const urlResult = normalizePublicUrl(site.url, `${sitePath}.url`);
      if (!urlResult.ok) {
        return urlResult;
      }
    }
  }

  return null;
}

export function parsePublicHomeDocument(input: unknown): PublicHomeDocumentResult {
  if (!isRecord(input)) {
    return failure("invalid-source");
  }

  if (input.version !== PUBLIC_HOME_DOCUMENT_VERSION) {
    return failure(typeof input.version === "number" ? "unsupported-version" : "invalid-source", "version");
  }

  if (!hasExactKeys(input, ["version", "documentTitle", "theme", "groups"])) {
    return failure("invalid-source");
  }

  const titleError = validateTextField(
    input.documentTitle,
    PUBLIC_HOME_MAX_DOCUMENT_TITLE_LENGTH,
    "documentTitle"
  );
  if (titleError) {
    return titleError;
  }

  if (!isRecord(input.theme) || !hasExactKeys(input.theme, ["presetId", "accent"])) {
    return failure("invalid-source", "theme");
  }

  if (!isHomeThemePresetId(input.theme.presetId)) {
    return failure("invalid-source", "theme.presetId");
  }

  const accent = normalizeThemeAccent(input.theme.accent);
  if (!accent || accent !== input.theme.accent) {
    return failure("invalid-source", "theme.accent");
  }

  if (!Array.isArray(input.groups)) {
    return failure("invalid-source", "groups");
  }

  if (input.groups.length === 0) {
    return failure("empty-content");
  }

  if (input.groups.length > PUBLIC_HOME_MAX_GROUPS) {
    return failure("group-limit-exceeded", "groups");
  }

  const groups: ReadOnlyHomeGroup[] = [];
  let totalSites = 0;

  for (let groupOffset = 0; groupOffset < input.groups.length; groupOffset += 1) {
    const rawGroup = input.groups[groupOffset];
    const groupPath = `groups[${groupOffset}]`;
    if (!isRecord(rawGroup) || !hasExactKeys(rawGroup, ["id", "title", "order", "sites"])) {
      return failure("invalid-source", groupPath);
    }

    const groupIndex = groupOffset + 1;
    if (rawGroup.id !== `group-${groupIndex}` || rawGroup.order !== groupIndex) {
      return failure("invalid-source", groupPath);
    }

    const groupTitleError = validateTextField(
      rawGroup.title,
      PUBLIC_HOME_MAX_GROUP_TITLE_LENGTH,
      `${groupPath}.title`
    );
    if (groupTitleError) {
      return groupTitleError;
    }

    if (!Array.isArray(rawGroup.sites)) {
      return failure("invalid-source", `${groupPath}.sites`);
    }

    if (rawGroup.sites.length === 0) {
      return failure("invalid-source", `${groupPath}.sites`);
    }

    if (rawGroup.sites.length > PUBLIC_HOME_MAX_SITES_PER_GROUP) {
      return failure("site-limit-exceeded", `${groupPath}.sites`);
    }

    const sites: ReadOnlyHomeSite[] = [];
    for (let siteOffset = 0; siteOffset < rawGroup.sites.length; siteOffset += 1) {
      const rawSite = rawGroup.sites[siteOffset];
      const sitePath = `${groupPath}.sites[${siteOffset}]`;
      if (!isRecord(rawSite) || !hasExactKeys(rawSite, ["id", "name", "url", "mark", "order"])) {
        return failure("invalid-source", sitePath);
      }

      totalSites += 1;
      if (totalSites > PUBLIC_HOME_MAX_TOTAL_SITES) {
        return failure("site-limit-exceeded", "groups[].sites");
      }

      const siteIndex = siteOffset + 1;
      if (rawSite.id !== `site-${groupIndex}-${siteIndex}` || rawSite.order !== siteIndex) {
        return failure("invalid-source", sitePath);
      }

      const nameError = validateTextField(
        rawSite.name,
        PUBLIC_HOME_MAX_SITE_NAME_LENGTH,
        `${sitePath}.name`
      );
      if (nameError) {
        return nameError;
      }

      const markError = validateTextField(
        rawSite.mark,
        PUBLIC_HOME_MAX_SITE_MARK_LENGTH,
        `${sitePath}.mark`
      );
      if (markError) {
        return markError;
      }

      const urlResult = normalizePublicUrl(rawSite.url, `${sitePath}.url`);
      if (!urlResult.ok) {
        return urlResult;
      }

      if (urlResult.url !== rawSite.url) {
        return failure("invalid-source", `${sitePath}.url`);
      }

      sites.push({
        id: rawSite.id,
        name: rawSite.name as string,
        url: rawSite.url as string,
        mark: rawSite.mark as string,
        order: rawSite.order
      });
    }

    groups.push({
      id: rawGroup.id,
      title: rawGroup.title as string,
      order: rawGroup.order,
      sites
    });
  }

  return finalize({
    version: PUBLIC_HOME_DOCUMENT_VERSION,
    documentTitle: input.documentTitle as string,
    theme: {
      presetId: input.theme.presetId,
      accent
    },
    groups
  });
}

export function isPublicHomeDocumentV1(input: unknown): input is PublicHomeDocumentV1 {
  return parsePublicHomeDocument(input).ok;
}

export function serializePublicHomeDocument(documentValue: PublicHomeDocumentV1): string {
  return JSON.stringify({
    version: PUBLIC_HOME_DOCUMENT_VERSION,
    documentTitle: documentValue.documentTitle,
    theme: {
      presetId: documentValue.theme.presetId,
      accent: documentValue.theme.accent
    },
    groups: documentValue.groups.map((group) => ({
      id: group.id,
      title: group.title,
      order: group.order,
      sites: group.sites.map((site) => ({
        id: site.id,
        name: site.name,
        url: site.url,
        mark: site.mark,
        order: site.order
      }))
    }))
  });
}

function finalize(documentValue: PublicHomeDocumentV1): PublicHomeDocumentResult {
  const serialized = serializePublicHomeDocument(documentValue);
  const byteSize = new TextEncoder().encode(serialized).byteLength;
  if (byteSize > PUBLIC_HOME_MAX_PAYLOAD_BYTES) {
    return failure("payload-too-large");
  }

  return {
    ok: true,
    document: documentValue,
    serialized,
    byteSize
  };
}

function validateTextField(
  value: unknown,
  maxLength: number,
  path: string
): Extract<PublicHomeDocumentResult, { ok: false }> | null {
  if (typeof value !== "string" || !value || value.trim() !== value) {
    return failure("invalid-source", path);
  }

  if ([...value].length > maxLength) {
    return failure("field-limit-exceeded", path);
  }

  return null;
}

function normalizePublicUrl(
  value: unknown,
  path: string
): { ok: true; url: string } | Extract<PublicHomeDocumentResult, { ok: false }> {
  if (typeof value !== "string" || !value || value.trim() !== value) {
    return failure("invalid-source", path);
  }

  if ([...value].length > PUBLIC_HOME_MAX_SITE_URL_LENGTH) {
    return failure("field-limit-exceeded", path);
  }

  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
      return failure("unsafe-url", path);
    }

    const normalized = url.href;
    if ([...normalized].length > PUBLIC_HOME_MAX_SITE_URL_LENGTH) {
      return failure("field-limit-exceeded", path);
    }

    return { ok: true, url: normalized };
  } catch {
    return failure("unsafe-url", path);
  }
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: string[]): boolean {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return actualKeys.length === sortedExpectedKeys.length
    && actualKeys.every((key, index) => key === sortedExpectedKeys[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function failure(
  code: PublicHomeDocumentErrorCode,
  path?: string
): Extract<PublicHomeDocumentResult, { ok: false }> {
  return path ? { ok: false, code, path } : { ok: false, code };
}
