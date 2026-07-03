"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import type { HomeSpace } from "@/domain/account";
import type { HomeSyncMeta } from "@/domain/home-document";
import type { StoredSyncBinding } from "@/domain/sync-code";
import type { AccountDataState } from "@/hooks/use-account-data";
import { useI18n } from "@/hooks/use-i18n";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";

interface AccountPanelProps {
  accountData: AccountDataState;
  currentBinding?: StoredSyncBinding | null;
  currentHomeSpace?: HomeSpace | null;
  embedded?: boolean;
  syncActionSlotId?: string;
  syncStatus?: HomeSyncMeta["status"];
}

export function AccountPanel({
  accountData,
  currentBinding = null,
  currentHomeSpace = null,
  embedded = false,
  syncActionSlotId,
  syncStatus = "local-only"
}: AccountPanelProps) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const {
    user,
    configured,
    loading,
    actionPending,
    message,
    error,
    signInWithMagicLink,
    signOut
  } = useSupabaseAuth();

  const accountInitial = useMemo(() => getAccountInitial(user?.email), [user?.email]);
  const accountHasError = Boolean((configured && error) || accountData.error);
  const accountStatusTone = !configured ? "warning" : accountHasError ? "danger" : accountData.profile ? "success" : "neutral";
  const authActionDisabledReason = getAuthActionDisabledReason(configured, loading, actionPending, t);
  const syncSummary = getAccountSyncSummary({
    configured,
    currentBinding,
    currentHomeSpace,
    signedIn: Boolean(user),
    syncStatus,
    t
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await signInWithMagicLink(email);
  }

  const content = (
    <>
      {user ? (
        <div className="account-card">
          <span className="avatar account-avatar">{accountInitial}</span>
          <div className="account-card-copy">
            <strong>{user.email ?? t("settings.account.signedInFallback")}</strong>
            <p>{getAccountDescription(accountData, t)}</p>
          </div>
          <button className="utility-button account-sign-out-button" type="button" onClick={signOut} disabled={actionPending} title={actionPending ? t("settings.account.pendingTitle") : t("settings.account.signOutTitle")}>
            {actionPending ? t("settings.account.signingOut") : t("settings.account.signOut")}
          </button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>{t("settings.account.email")}</span>
            <input
              type="email"
              value={email}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={!configured || loading || actionPending}
              title={authActionDisabledReason}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button className="utility-button" type="submit" disabled={!configured || loading || actionPending} title={authActionDisabledReason}>
            {actionPending ? t("settings.account.sending") : t("settings.account.sendLink")}
          </button>
        </form>
      )}

      <div className="account-sync-summary" aria-label={t("settings.account.syncSummaryAria")}>
        <div>
          <span>{t("settings.account.currentHome")}</span>
          <strong>{syncSummary.title}</strong>
        </div>
        <StatusMessage tone={syncSummary.tone}>
          {syncSummary.detail}
        </StatusMessage>
        {syncActionSlotId ? (
          <div id={syncActionSlotId} className="account-sync-action-slot" />
        ) : null}
      </div>

      <StatusMessage role={accountHasError ? "alert" : "status"} tone={accountStatusTone}>
        {error || getAccountStatus(accountData, message, loading, t)}
      </StatusMessage>
    </>
  );

  if (embedded) {
    return <div className="account-panel">{content}</div>;
  }

  return (
    <section className="settings-panel account-panel" aria-label={t("settings.account.panelAria")}>
      <div className="panel-header">
        <h2>{t("settings.section.account.title")}</h2>
        <span>{user ? t("settings.section.account.signedIn") : t("settings.section.account.magicLink")}</span>
      </div>
      {content}
    </section>
  );
}

function getAccountInitial(email?: string): string {
  const value = email?.trim();
  if (!value) {
    return "A";
  }

  return value.slice(0, 1).toUpperCase();
}

function getAccountDescription(accountData: AccountDataState, t: ReturnType<typeof useI18n>["t"]): string {
  if (accountData.loading) {
    return t("settings.account.descriptionLoading");
  }

  if (accountData.error) {
    return t("settings.account.descriptionError");
  }

  if (accountData.profile) {
    return t("settings.account.descriptionReady");
  }

  return t("settings.account.descriptionLocal");
}

function getAccountStatus(accountData: AccountDataState, authMessage: string, authLoading: boolean, t: ReturnType<typeof useI18n>["t"]): string {
  if (accountData.error) {
    return t("settings.account.statusLoadFailed", { error: accountData.error });
  }

  if (accountData.loading) {
    return t("settings.account.statusLoading");
  }

  if (accountData.profile) {
    return t("settings.account.statusReady");
  }

  return authMessage || (authLoading ? t("settings.account.authLoading") : t("settings.account.statusDefault"));
}

function getAuthActionDisabledReason(configured: boolean, loading: boolean, actionPending: boolean, t: ReturnType<typeof useI18n>["t"]): string | undefined {
  if (!configured) {
    return t("settings.account.authNotConfigured");
  }

  if (actionPending) {
    return t("settings.account.pendingTitle");
  }

  if (loading) {
    return t("settings.account.authLoading");
  }

  return undefined;
}

function getAccountSyncSummary({
  configured,
  currentBinding,
  currentHomeSpace,
  signedIn,
  syncStatus,
  t
}: {
  configured: boolean;
  currentBinding: StoredSyncBinding | null;
  currentHomeSpace: HomeSpace | null;
  signedIn: boolean;
  syncStatus: HomeSyncMeta["status"];
  t: ReturnType<typeof useI18n>["t"];
}): { detail: string; title: string; tone: "neutral" | "info" | "success" | "warning" | "danger" } {
  if (!configured) {
    return {
      detail: t("settings.account.summaryServiceMissingDetail"),
      title: t("settings.account.summaryServiceMissingTitle"),
      tone: "warning"
    };
  }

  if (syncStatus === "conflict") {
    if (signedIn && currentBinding) {
      return {
        detail: t("settings.account.summaryConflictDetailInline"),
        title: t("settings.account.summaryConflictTitle"),
        tone: "danger"
      };
    }

    return {
      detail: t("settings.account.summaryConflictDetailAdvanced"),
      title: t("settings.account.summaryConflictTitle"),
      tone: "danger"
    };
  }

  if (syncStatus === "paused") {
    if (signedIn && currentBinding) {
      return {
        detail: t("settings.account.summaryPausedDetailInline"),
        title: t("settings.account.summaryPausedTitle"),
        tone: "warning"
      };
    }

    return {
      detail: t("settings.account.summaryPausedDetailAdvanced"),
      title: t("settings.account.summaryPausedTitle"),
      tone: "warning"
    };
  }

  if (currentBinding?.accessMode === "account-managed") {
    return {
      detail: currentHomeSpace
        ? t("settings.account.summaryManagedDetailWithName", { space: currentHomeSpace.name })
        : t("settings.account.summaryManagedDetailNoName"),
      title: t("settings.account.summaryManagedTitle"),
      tone: "success"
    };
  }

  if (currentBinding?.accessMode === "sync-code") {
    return {
      detail: currentHomeSpace
        ? t("settings.account.summarySyncCodeDetailWithName", { space: currentHomeSpace.name })
        : signedIn
          ? t("settings.account.summarySyncCodeDetailSignedIn")
          : t("settings.account.summarySyncCodeDetailSignedOut"),
      title: t("settings.account.summarySyncCodeTitle"),
      tone: "info"
    };
  }

  return {
    detail: signedIn
      ? t("settings.account.summaryLocalDetailSignedIn")
      : t("settings.account.summaryLocalDetailSignedOut"),
    title: t("settings.account.summaryLocalTitle"),
    tone: "neutral"
  };
}
