export const PUBLIC_HOME_SHARE_TOKEN_BYTES = 32;
export const PUBLIC_HOME_SHARE_TOKEN_LENGTH = 43;

const PUBLIC_HOME_SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export class PublicHomeShareTokenGenerationError extends Error {
  constructor() {
    super("Secure random generation is unavailable for public sharing.");
    this.name = "PublicHomeShareTokenGenerationError";
  }
}

/**
 * Creates the v1 public-share secret. It is 256 bits of browser-generated
 * randomness encoded as unpadded Base64URL, and is intended to exist only in
 * the caller's memory and the URL fragment for the current publish session.
 */
export function createPublicHomeShareToken(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new PublicHomeShareTokenGenerationError();
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(PUBLIC_HOME_SHARE_TOKEN_BYTES));
  return toBase64Url(bytes);
}

export function isPublicHomeShareToken(value: unknown): value is string {
  return typeof value === "string"
    && value.length === PUBLIC_HOME_SHARE_TOKEN_LENGTH
    && PUBLIC_HOME_SHARE_TOKEN_PATTERN.test(value);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return globalThis.btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
