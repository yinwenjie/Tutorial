import {
  parsePublicHomeDocument,
  PUBLIC_HOME_DOCUMENT_VERSION,
  type PublicHomeDocumentV1
} from "@/domain/public-home-document";
import { isPublicHomeShareToken } from "@/domain/public-home-share";
import { getSupabaseBrowserClient } from "@/infrastructure/supabase-client";

export type PublicHomeShareStatus = "active" | "revoked";

export interface PublicHomeShareMetadata {
  expiresAt: string | null;
  homeSpaceId: string;
  payloadVersion: typeof PUBLIC_HOME_DOCUMENT_VERSION;
  publishedAt: string;
  revokedAt: string | null;
  status: PublicHomeShareStatus;
  updatedAt: string;
}

export interface PublicHomeShareReadResult {
  document: PublicHomeDocumentV1;
  payloadVersion: typeof PUBLIC_HOME_DOCUMENT_VERSION;
}

export type PublicHomeShareRepositoryErrorCode =
  | "invalid-document"
  | "invalid-home-space"
  | "invalid-token"
  | "invalid-response"
  | "request-failed";

export class PublicHomeShareRepositoryError extends Error {
  constructor(
    readonly code: PublicHomeShareRepositoryErrorCode,
    readonly operation: "get-metadata" | "publish" | "read" | "revoke"
  ) {
    super("Public share operation could not be completed.");
    this.name = "PublicHomeShareRepositoryError";
  }
}

interface PublicHomeShareMetadataRow {
  expires_at: string | null;
  home_space_id: string;
  payload_version: number;
  published_at: string;
  revoked_at: string | null;
  status: string;
  updated_at: string;
}

interface PublicHomeShareReadRow {
  document_json: unknown;
  payload_version: number;
}

/**
 * The only browser-facing access point for public shares. It never persists
 * share tokens or snapshots locally and deliberately wraps RPC errors so a
 * caller cannot accidentally report a token, payload, or raw database error.
 */
export class PublicHomeShareRepository {
  async publish(
    homeSpaceId: string,
    token: string,
    documentValue: unknown
  ): Promise<PublicHomeShareMetadata> {
    assertHomeSpaceId(homeSpaceId, "publish");
    if (!isPublicHomeShareToken(token)) {
      throw new PublicHomeShareRepositoryError("invalid-token", "publish");
    }

    const document = parsePublicHomeDocument(documentValue);
    if (!document.ok) {
      throw new PublicHomeShareRepositoryError("invalid-document", "publish");
    }

    const { data, error } = await getSupabaseBrowserClient().rpc("upsert_public_home_share", {
      p_document_json: document.document,
      p_home_space_id: homeSpaceId,
      p_token: token
    });

    if (error) {
      throw new PublicHomeShareRepositoryError("request-failed", "publish");
    }

    const row = singleRow<PublicHomeShareMetadataRow>(data, "publish");
    return mapMetadata(row, "publish");
  }

  async getMetadata(homeSpaceId: string): Promise<PublicHomeShareMetadata | null> {
    assertHomeSpaceId(homeSpaceId, "get-metadata");

    const { data, error } = await getSupabaseBrowserClient().rpc("get_public_home_share_metadata", {
      p_home_space_id: homeSpaceId
    });

    if (error) {
      throw new PublicHomeShareRepositoryError("request-failed", "get-metadata");
    }

    const row = optionalSingleRow<PublicHomeShareMetadataRow>(data, "get-metadata");
    return row ? mapMetadata(row, "get-metadata") : null;
  }

  async revoke(homeSpaceId: string): Promise<PublicHomeShareMetadata | null> {
    assertHomeSpaceId(homeSpaceId, "revoke");

    const { data, error } = await getSupabaseBrowserClient().rpc("revoke_public_home_share", {
      p_home_space_id: homeSpaceId
    });

    if (error) {
      throw new PublicHomeShareRepositoryError("request-failed", "revoke");
    }

    const row = optionalSingleRow<PublicHomeShareMetadataRow>(data, "revoke");
    return row ? mapMetadata(row, "revoke") : null;
  }

  async read(token: string): Promise<PublicHomeShareReadResult | null> {
    if (!isPublicHomeShareToken(token)) {
      return null;
    }

    const { data, error } = await getSupabaseBrowserClient().rpc("read_public_home_share", {
      p_token: token
    });

    if (error) {
      throw new PublicHomeShareRepositoryError("request-failed", "read");
    }

    const row = optionalSingleRow<PublicHomeShareReadRow>(data, "read");
    if (!row) {
      return null;
    }

    if (row.payload_version !== PUBLIC_HOME_DOCUMENT_VERSION) {
      throw new PublicHomeShareRepositoryError("invalid-response", "read");
    }

    const document = parsePublicHomeDocument(row.document_json);
    if (!document.ok) {
      throw new PublicHomeShareRepositoryError("invalid-response", "read");
    }

    return {
      document: document.document,
      payloadVersion: PUBLIC_HOME_DOCUMENT_VERSION
    };
  }
}

function assertHomeSpaceId(
  homeSpaceId: string,
  operation: PublicHomeShareRepositoryError["operation"]
): void {
  if (!isUuid(homeSpaceId)) {
    throw new PublicHomeShareRepositoryError("invalid-home-space", operation);
  }
}

function optionalSingleRow<T>(
  value: unknown,
  operation: PublicHomeShareRepositoryError["operation"]
): T | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  if (value.length !== 1 || !isRecord(value[0])) {
    throw new PublicHomeShareRepositoryError("invalid-response", operation);
  }

  return value[0] as T;
}

function singleRow<T>(
  value: unknown,
  operation: PublicHomeShareRepositoryError["operation"]
): T {
  const row = optionalSingleRow<T>(value, operation);
  if (!row) {
    throw new PublicHomeShareRepositoryError("invalid-response", operation);
  }

  return row;
}

function mapMetadata(
  row: PublicHomeShareMetadataRow,
  operation: PublicHomeShareRepositoryError["operation"]
): PublicHomeShareMetadata {
  if (!isUuid(row.home_space_id)
    || row.payload_version !== PUBLIC_HOME_DOCUMENT_VERSION
    || (row.status !== "active" && row.status !== "revoked")
    || !isTimestamp(row.published_at)
    || !isTimestamp(row.updated_at)
    || !isNullableTimestamp(row.expires_at)
    || !isNullableTimestamp(row.revoked_at)) {
    throw new PublicHomeShareRepositoryError("invalid-response", operation);
  }

  if ((row.status === "active" && row.revoked_at !== null)
    || (row.status === "revoked" && row.revoked_at === null)) {
    throw new PublicHomeShareRepositoryError("invalid-response", operation);
  }

  return {
    expiresAt: row.expires_at,
    homeSpaceId: row.home_space_id,
    payloadVersion: PUBLIC_HOME_DOCUMENT_VERSION,
    publishedAt: row.published_at,
    revokedAt: row.revoked_at,
    status: row.status,
    updatedAt: row.updated_at
  };
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
