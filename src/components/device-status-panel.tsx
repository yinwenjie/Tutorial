"use client";

import { useEffect, useState } from "react";
import type { HomeSpace } from "@/domain/account";
import type { HomeDocumentV2 } from "@/domain/home-document";
import {
  type DocumentProtectionState
} from "@/domain/home-document-protection";
import { useI18n } from "@/hooks/use-i18n";
import {
  formatDeviceShortId,
  loadOrTouchLocalDevice,
  type LocalDeviceRecord
} from "@/infrastructure/local-device-repository";
import type { StoredSyncBinding } from "@/domain/sync-code";
import { formatSyncStatus } from "@/i18n/home-presentation";
import type { I18nTranslate } from "@/i18n/messages";
import { formatSettingsHomeDocumentClass } from "@/i18n/settings-presentation";

interface DeviceStatusPanelProps {
  currentBinding: StoredSyncBinding | null;
  currentHomeSpace: HomeSpace | null;
  documentProtection: DocumentProtectionState;
  documentValue: HomeDocumentV2;
  signedIn: boolean;
}

export function DeviceStatusPanel({
  currentBinding,
  currentHomeSpace,
  documentProtection,
  documentValue,
  signedIn
}: DeviceStatusPanelProps) {
  const { format, t } = useI18n();
  const [device, setDevice] = useState<LocalDeviceRecord | null>(null);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDevice(loadOrTouchLocalDevice());
    }, 0);

    return () => window.clearTimeout(timerId);
  }, []);

  const bindingLabel = currentBinding
    ? currentBinding.accessMode === "account-managed"
      ? t("settings.sync.access.accountManaged")
      : t("settings.sync.access.syncCode")
    : t("settings.sync.statusUnbound");

  return (
    <div className="advanced-operation-block">
      <div className="advanced-operation-head">
        <h3>{t("settings.device.title")}</h3>
        <span>{t("settings.device.kicker")}</span>
      </div>
      <div className="device-status-grid">
        <DeviceStatusItem label={t("settings.device.localId")} value={formatDeviceShortId(device?.id)} />
        <DeviceStatusItem label={t("settings.device.accountStatus")} value={signedIn ? t("settings.device.signedIn") : t("settings.device.signedOut")} />
        <DeviceStatusItem label={t("settings.device.syncMode")} value={bindingLabel} />
        <DeviceStatusItem label={t("settings.device.homeSpace")} value={currentHomeSpace?.name ?? currentBinding?.spaceId ?? t("settings.device.localHome")} />
        <DeviceStatusItem label={t("settings.device.homeStatus")} value={formatSyncStatus(documentValue.syncMeta.status, t)} />
        <DeviceStatusItem label={t("settings.device.documentClass")} value={formatSettingsHomeDocumentClass(documentProtection.documentClass, t)} />
        <DeviceStatusItem label={t("settings.device.localRevision")} value={t("settings.device.revisionValue", { revision: String(documentValue.revision) })} />
        <DeviceStatusItem label={t("settings.device.documentUpdated")} value={formatOptionalDateTime(documentValue.updatedAt, format.shortDateTime, t)} />
        <DeviceStatusItem label={t("settings.device.lastSeen")} value={formatOptionalDateTime(device?.lastSeenAt, format.shortDateTime, t)} />
      </div>
    </div>
  );
}

function DeviceStatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="device-status-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatOptionalDateTime(value: string | null | undefined, format: (value: string) => string, t: I18nTranslate): string {
  if (!value) {
    return t("settings.device.unknown");
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return t("settings.device.unknown");
  }

  return format(value);
}
